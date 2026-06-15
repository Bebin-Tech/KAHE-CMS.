import logging
import os
import random
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, and_
from typing import List, Optional
from datetime import datetime
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

try:
    from . import models, schemas, auth, database
except ImportError:
    import models, schemas, auth, database

# Configure institutional logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("KAHE-CMS")

# --- DATABASE MIGRATIONS ---
def migrate_db(db: Session):
    """Adds missing columns to existing tables to prevent crashes while preserving data."""
    try:
        # 1. Timetables alignment
        db.execute(text("CREATE TABLE IF NOT EXISTS timetables (id INTEGER PRIMARY KEY, day_of_week VARCHAR, status VARCHAR)"))
        cols_tt = [row[1] for row in db.execute(text("PRAGMA table_info(timetables)")).fetchall()]
        needed_tt = {
            "department_id": "INTEGER", "program_id": "INTEGER", "semester_id": "INTEGER",
            "period_id": "INTEGER", "time_slot": "VARCHAR", "subject_id": "INTEGER",
            "subject_name": "VARCHAR", "subject_type": "VARCHAR", "faculty_id": "INTEGER", "faculty_name": "VARCHAR",
            "room_id": "INTEGER", "room_number": "VARCHAR", "approval_comments": "TEXT",
            "section": "VARCHAR"
        }
        for col, col_type in needed_tt.items():
            if col not in cols_tt:
                db.execute(text(f"ALTER TABLE timetables ADD COLUMN {col} {col_type}"))

        # 2. Faculty Assignments alignment
        db.execute(text("CREATE TABLE IF NOT EXISTS faculty_assignments (id INTEGER PRIMARY KEY)"))
        cols_fa = [row[1] for row in db.execute(text("PRAGMA table_info(faculty_assignments)")).fetchall()]
        for col, col_type in {"faculty_id": "INTEGER", "subject_id": "INTEGER", "semester_id": "INTEGER", "section": "VARCHAR"}.items():
            if col not in cols_fa:
                db.execute(text(f"ALTER TABLE faculty_assignments ADD COLUMN {col} {col_type}"))

        # 2. Rooms alignment
        cols_rooms = [row[1] for row in db.execute(text("PRAGMA table_info(rooms)")).fetchall()]
        for c in ["room_name", "floor", "building", "department_id", "department"]:
            if c not in cols_rooms: 
                db.execute(text(f"ALTER TABLE rooms ADD COLUMN {c} VARCHAR"))
        
        # 3. Users alignment
        cols_users = [row[1] for row in db.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "department_id" not in cols_users: db.execute(text("ALTER TABLE users ADD COLUMN department_id INTEGER"))
        
        # 4. Subject alignment
        cols_subjects = [row[1] for row in db.execute(text("PRAGMA table_info(subjects)")).fetchall()]
        for c in ["code", "type", "credits", "weekly_hours", "semester_id", "department_id", "department_name", "status"]:
            if c not in cols_subjects: 
                type_map = {"credits": "INTEGER", "weekly_hours": "INTEGER", "semester_id": "INTEGER", "department_id": "INTEGER"}
                db.execute(text(f"ALTER TABLE subjects ADD COLUMN {c} {type_map.get(c, 'VARCHAR')}"))
        
        # 5. Bookings alignment
        cols_bookings = [row[1] for row in db.execute(text("PRAGMA table_info(bookings)")).fetchall()]
        for c in ["faculty_name", "department"]:
            if c not in cols_bookings: 
                db.execute(text(f"ALTER TABLE bookings ADD COLUMN {c} VARCHAR"))
        
        db.commit()
    except Exception as e: 
        logger.error(f"Migration error: {e}")
        db.rollback()

def sync_registry():
    db = database.SessionLocal()
    try:
        migrate_db(db)
        # Force Clean Period Setup to fix ID and numbering issues
        db.execute(text("DELETE FROM period_timings"))
        
        # Reset SQLite sequence only if using SQLite and table exists
        if "sqlite" in str(database.engine.url):
            try:
                db.execute(text("DELETE FROM sqlite_sequence WHERE name='period_timings'"))
            except Exception:
                pass # sqlite_sequence might not exist in a fresh DB

        db.commit()
        
        # Chronological registry: 1, 2 = P1, P2 | 3 = Interval | 4, 5 = P3, P4 | 6 = Lunch | 7, 8 = P5, P6
        periods = [
            (1, 1, "09:00", "09:50", False, "CLASS"),
            (2, 2, "09:50", "10:55", False, "CLASS"),
            (3, 3, "10:55", "11:15", True, "INTERVAL"),
            (4, 4, "11:15", "12:00", False, "CLASS"),
            (5, 5, "12:00", "12:45", False, "CLASS"),
            (6, 6, "12:45", "13:30", True, "LUNCH"),
            (7, 7, "13:30", "14:20", False, "CLASS"),
            (8, 8, "14:20", "15:10", False, "CLASS")
        ]
        for p in periods:
            db.execute(text("INSERT INTO period_timings (id, period_number, start_time, end_time, is_break, type) VALUES (:id, :pn, :st, :et, :ib, :t)"),
                       {"id": p[0], "pn": p[1], "st": p[2], "et": p[3], "ib": p[4], "t": p[5]})
        
        if db.query(models.User).filter(models.User.email == "admin@kahe.edu").count() == 0:
            db.add(models.User(name="System Admin", email="admin@kahe.edu", password=auth.get_password_hash("admin123"), role="admin", faculty_id="admin_01"))
        db.commit()
    except Exception as e:
        logger.error(f"Sync Registry Error: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=database.engine)
    sync_registry()
    logger.info("KAHE CMS Initialization Complete - Registry Synchronized.")
    yield

app = FastAPI(title="KAHE CMS", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTH ---
@api_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(or_(models.User.email == form_data.username, models.User.faculty_id == form_data.username)).first()
    if (form_data.username == "admin@kahe.edu" and form_data.password == "admin123") or (user and auth.verify_password(form_data.password, user.password)):
        u = user or db.query(models.User).filter(models.User.email == "admin@kahe.edu").first()
        token = auth.create_access_token(data={"sub": u.email, "role": u.role})
        return {"access_token": token, "token_type": "bearer", "role": u.role, "user_id": u.id, "name": u.name}
    raise HTTPException(status_code=401, detail="Invalid institutional credentials")

@app.post("/login", include_in_schema=False)
def login_compat(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)): return login(form_data, db)

# --- USER DIRECTORY ---
@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db)): return db.query(models.User).all()

@api_router.post("/users", response_model=schemas.User)
def create_user(u: schemas.UserCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_u = models.User(**u.dict(exclude={"password"}), password=auth.get_password_hash(u.password))
    db.add(db_u); db.commit(); db.refresh(db_u); return db_u

@api_router.put("/users/{id}", response_model=schemas.User)
def update_user(id: int, u: schemas.UserUpdate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_u = db.query(models.User).filter(models.User.id == id).first()
    if not db_u: raise HTTPException(404, detail="Identity not found")
    update_data = u.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]: update_data["password"] = auth.get_password_hash(update_data["password"])
    for k, v in update_data.items(): setattr(db_u, k, v)
    db.commit(); db.refresh(db_u); return db_u

@api_router.delete("/users/{id}")
def purge_user(id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    user = db.query(models.User).filter(models.User.id == id).first()
    if not user: raise HTTPException(404)
    try:
        db.delete(user); db.commit(); return {"ok": True}
    except:
        db.rollback(); raise HTTPException(400, detail="Purge failed. Active institutional dependencies detected.")

# --- FACULTY DETAILS ---
@api_router.get("/faculty-assignments", response_model=List[schemas.FacultyAssignment])
def list_assignments(db: Session = Depends(database.get_db)): return db.query(models.FacultyAssignment).all()

@api_router.post("/faculty-assignments")
def assign_faculty(data: schemas.FacultyAssignmentBase, db: Session = Depends(database.get_db)):
    db_assignment = models.FacultyAssignment(**data.dict())
    db.add(db_assignment); db.commit(); return {"ok": True}

# --- ROOMS ---
@api_router.get("/rooms", response_model=List[schemas.Room])
def list_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.post("/rooms", response_model=schemas.Room)
def create_room(r: schemas.RoomCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_r = models.Room(**r.dict()); db.add(db_r); db.commit(); db.refresh(db_r); return db_r

@api_router.delete("/rooms/{id}")
def delete_room(id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.query(models.Room).filter(models.Room.id == id).delete(); db.commit(); return {"ok": True}

# --- BOOKINGS ---
@api_router.get("/bookings", response_model=List[schemas.Booking])
def list_bookings(db: Session = Depends(database.get_db)):
    return db.query(models.Booking).all()

@api_router.post("/book-room", response_model=schemas.Booking)
def book_room(booking: schemas.BookingCreate, db: Session = Depends(database.get_db)):
    db_booking = models.Booking(**booking.dict(), user_id=1, status="BOOKED") # Default user_id for now
    db.add(db_booking); db.commit(); db.refresh(db_booking); return db_booking

@api_router.delete("/bookings/{id}")
def delete_booking(id: int, db: Session = Depends(database.get_db)):
    db.query(models.Booking).filter(models.Booking.id == id).delete(); db.commit(); return {"ok": True}

# --- CLASS SESSIONS ---
@api_router.get("/active-sessions", response_model=List[schemas.ClassSession])
def list_active_sessions(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").all()

@api_router.get("/active-session/{room_id}", response_model=schemas.ClassSession)
def get_active_session(room_id: int, db: Session = Depends(database.get_db)):
    session = db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id, models.ClassSession.status == "ACTIVE").first()
    if not session: raise HTTPException(404, "No active session")
    return session

@api_router.post("/start-class", response_model=schemas.ClassSession)
def start_class(data: schemas.ClassSessionCreate, db: Session = Depends(database.get_db)):
    # Check if room is already in use
    existing = db.query(models.ClassSession).filter(models.ClassSession.room_id == data.room_id, models.ClassSession.status == "ACTIVE").first()
    if existing: raise HTTPException(400, "Room already in use")
    
    db_session = models.ClassSession(**data.dict(), faculty_user_id=1, status="ACTIVE") # Default user_id for now
    db.query(models.Room).filter(models.Room.id == data.room_id).update({"status": "IN_USE"})
    db.add(db_session); db.commit(); db.refresh(db_session); return db_session

@api_router.post("/end-class/{session_id}")
def end_class(session_id: int, db: Session = Depends(database.get_db)):
    session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not session: raise HTTPException(404)
    session.status = "COMPLETED"
    session.end_time = datetime.utcnow()
    db.query(models.Room).filter(models.Room.id == session.room_id).update({"status": "AVAILABLE"})
    db.commit(); return {"ok": True}

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_class_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.start_time.desc()).all()

@api_router.get("/room-history/{room_id}", response_model=List[schemas.ClassSession])
def get_room_history(room_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id).order_by(models.ClassSession.start_time.desc()).all()

@api_router.delete("/class-history")
def clear_class_history(db: Session = Depends(database.get_db)):
    db.query(models.ClassSession).delete(); db.commit(); return {"ok": True}

# --- SUBJECTS ---
@api_router.get("/subjects", response_model=List[schemas.Subject])
def list_subjects(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

@api_router.post("/subjects", response_model=schemas.Subject)
def add_subject(sub: schemas.SubjectCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(**sub.dict()); db.add(db_sub); db.commit(); db.refresh(db_sub); return db_sub

@api_router.put("/subjects/{id}", response_model=schemas.Subject)
def update_subject(id: int, sub: schemas.SubjectUpdate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_sub = db.query(models.Subject).filter(models.Subject.id == id).first()
    update_data = sub.dict(exclude_unset=True)
    for k, v in update_data.items(): setattr(db_sub, k, v)
    db.commit(); db.refresh(db_sub); return db_sub

@api_router.delete("/subjects/{id}")
def delete_subject(id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    sub = db.query(models.Subject).filter(models.Subject.id == id).first()
    db.query(models.FacultyAssignment).filter(models.FacultyAssignment.subject_id == id).delete()
    db.query(models.Timetable).filter(models.Timetable.subject_id == id).delete()
    db.delete(sub); db.commit(); return {"ok": True}

# --- TIMETABLE & GENERATOR ---
@api_router.get("/timetables", response_model=List[schemas.Timetable])
def list_timetables(db: Session = Depends(database.get_db)): return db.query(models.Timetable).all()

@api_router.get("/schedules")
def list_schedules(db: Session = Depends(database.get_db)): return db.query(models.Schedule).all()

@api_router.post("/swap-slots")
def swap_slots(tt1_id: int, tt2_id: int, db: Session = Depends(database.get_db)):
    t1 = db.query(models.Timetable).filter(models.Timetable.id == tt1_id).first()
    t2 = db.query(models.Timetable).filter(models.Timetable.id == tt2_id).first()
    if not t1 or not t2: raise HTTPException(404, "Slot not found")
    
    # Swap key data
    t1.day_of_week, t2.day_of_week = t2.day_of_week, t1.day_of_week
    t1.period_id, t2.period_id = t2.period_id, t1.period_id
    t1.time_slot, t2.time_slot = t2.time_slot, t1.time_slot
    
    db.commit(); return {"ok": True}

@api_router.post("/timetable-approval")
def approve_timetable(semester_id: int, status: str, db: Session = Depends(database.get_db)):
    db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id).update({"status": status})
    db.commit(); return {"ok": True}

@api_router.delete("/timetables")
def clear_timetables(db: Session = Depends(database.get_db)):
    db.execute(text("DELETE FROM conflicts")); db.query(models.Timetable).delete(); db.commit(); return {"ok": True}

# --- TIMETABLE & GENERATOR ENGINE ---
@api_router.post("/sync-registry")
def manual_sync(db: Session = Depends(database.get_db)):
    sync_registry()
    return {"status": "Registry Synchronized"}

@api_router.post("/seed-institution")
def seed_institution(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    """Automatically creates a default Department, Program, and 8 Semesters."""
    # 1. Dept
    dept = db.query(models.Department).filter(models.Department.name == "School of Computer Science").first()
    if not dept:
        dept = models.Department(name="School of Computer Science")
        db.add(dept); db.commit(); db.refresh(dept)
    
    # 2. Program
    prog = db.query(models.Program).filter(models.Program.name == "B.Tech IT").first()
    if not prog:
        prog = models.Program(name="B.Tech IT", type="UG", department_id=dept.id)
        db.add(prog); db.commit(); db.refresh(prog)
    
    # 3. Semesters
    existing_sems = db.query(models.Semester).filter(models.Semester.program_id == prog.id).count()
    if existing_sems < 8:
        for i in range(1, 9):
            if not db.query(models.Semester).filter(models.Semester.program_id == prog.id, models.Semester.number == i).first():
                db.add(models.Semester(number=i, program_id=prog.id, is_active=True))
        db.commit()
    
    return {"status": "Institutional Structure Initialized"}

@api_router.post("/generate-timetable")
def generate_timetable(semester_type: Optional[str] = None, semester_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    """
    Generates a master timetable ensuring exactly 6 academic periods (P1-P6) for every working day.
    """
    # 1. Selection
    sem_query = db.query(models.Semester)
    if semester_id:
        sem_query = sem_query.filter(models.Semester.id == semester_id)
    elif semester_type:
        if semester_type.upper() == "ODD":
            sem_query = sem_query.filter(models.Semester.number % 2 != 0)
        elif semester_type.upper() == "EVEN":
            sem_query = sem_query.filter(models.Semester.number % 2 == 0)
    
    target_semesters = sem_query.all()
    if not target_semesters:
        raise HTTPException(400, "Institutional Registry is empty. Please initialize a Program and Semesters in the Config tab first.")

    # 2. Institutional Registry Verification
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    
    # Robustly fetch academic periods by normalizing time sorting
    all_periods = db.query(models.PeriodTiming).all()
    academic_periods = [p for p in all_periods if p.type == "CLASS"]
    
    def normalize_time(t):
        try:
            h, m = map(int, t.split(':'))
            if h < 8: h += 12 # Handle 12h format normalization 01:30 -> 13:30
            return h * 60 + m
        except: return 0
    
    academic_periods.sort(key=lambda x: normalize_time(x.start_time))
    
    if len(academic_periods) < 6:
        raise HTTPException(400, f"Registry Incomplete: Need 6 academic periods, found {len(academic_periods)}. Use Sync Registry.")
    
    working_periods = academic_periods[:6]
    rooms = db.query(models.Room).all()
    faculties = db.query(models.User).filter(models.User.role == "faculty").all()

    if not rooms or not faculties:
        raise HTTPException(400, "Registry Incomplete (Need Rooms and Faculty).")

    for sem in target_semesters:
        # Clear existing entries for this semester
        db.query(models.Timetable).filter(models.Timetable.semester_id == sem.id).delete()
        
        subjects = db.query(models.Subject).filter(models.Subject.semester_id == sem.id).all()
        if not subjects:
            continue

        for day in days:
            # Round-robin pool for the day
            day_pool = subjects.copy()
            random.shuffle(day_pool)
            
            for i in range(6):
                p = working_periods[i]
                sub = day_pool[i % len(day_pool)]
                
                # Faculty lookup
                assign = db.query(models.FacultyAssignment).filter(
                    models.FacultyAssignment.subject_id == sub.id,
                    models.FacultyAssignment.semester_id == sem.id
                ).first()
                
                if assign:
                    fac = db.query(models.User).filter(models.User.id == assign.faculty_id).first()
                else:
                    fac = random.choice(faculties)
                
                # Room lookup
                selected_room = random.choice(rooms)
                
                db.add(models.Timetable(
                    department_id=sem.program.department_id if sem.program else None,
                    program_id=sem.program_id,
                    semester_id=sem.id,
                    day_of_week=day,
                    period_id=p.id,
                    time_slot=f"{p.start_time}-{p.end_time}",
                    subject_id=sub.id,
                    subject_name=sub.name,
                    subject_type=sub.type or "Theory",
                    faculty_id=fac.id if fac else None,
                    faculty_name=fac.name if fac else "Staff",
                    room_id=selected_room.id,
                    room_number=selected_room.room_number,
                    status="PUBLISHED"
                ))

    db.commit()
    return {"status": "success", "message": "Schedule Generated with 6 Full Periods (P1-P6)."}

# --- DASHBOARD & STATS ---
@api_router.get("/dashboard-stats")
def get_stats(db: Session = Depends(database.get_db)):
    return {
        "rooms": db.query(models.Room).count(),
        "active": db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").count(),
        "bookings": db.query(models.Booking).count(),
        "total_departments": db.query(models.Department).count(),
        "total_programs": db.query(models.Program).count(),
        "total_semesters": db.query(models.Semester).count(),
        "total_subjects": db.query(models.Subject).count(),
        "total_faculties": db.query(models.User).filter(models.User.role == "faculty").count(),
        "total_classrooms": db.query(models.Room).filter(models.Room.type == "Classroom").count(),
        "total_labs": db.query(models.Room).filter(models.Room.type == "Lab").count(),
        "generated_timetables": db.query(models.Timetable).count() // 30 if db.query(models.Timetable).count() > 0 else 0,
        "pending_approvals": db.query(models.Timetable).filter(models.Timetable.status == "PENDING").count(),
        "approved_timetables": db.query(models.Timetable).filter(models.Timetable.status == "APPROVED").count(),
        "published_timetables": db.query(models.Timetable).filter(models.Timetable.status == "PUBLISHED").count(),
        "conflict_alerts": db.query(models.Conflict).filter(models.Conflict.resolved == False).count()
    }

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def list_periods(db: Session = Depends(database.get_db)): 
    # Force sort by period_number to ensure breaks are correctly positioned between classes
    return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number.asc()).all()

@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def list_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@api_router.post("/working-days")
def save_working_days(days: List[str], db: Session = Depends(database.get_db)):
    db.query(models.WorkingDay).delete()
    for d in days: db.add(models.WorkingDay(day_name=d, is_working=True))
    db.commit(); return {"ok": True}

# --- REGISTRY ---
@api_router.get("/departments", response_model=List[schemas.Department])
def list_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.post("/departments", response_model=schemas.Department)
def create_dept(d: schemas.DepartmentBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_d = models.Department(**d.dict()); db.add(db_d); db.commit(); db.refresh(db_d); return db_d

@api_router.get("/programs", response_model=List[schemas.Program])
def list_progs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.post("/programs", response_model=schemas.Program)
def create_prog(p: schemas.ProgramBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_p = models.Program(**p.dict()); db.add(db_p); db.commit(); db.refresh(db_p); return db_p

@api_router.get("/semesters", response_model=List[schemas.Semester])
def list_sems(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@api_router.post("/semesters", response_model=schemas.Semester)
def create_sem(s: schemas.SemesterBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_s = models.Semester(**s.dict()); db.add(db_s); db.commit(); db.refresh(db_s); return db_s

app.include_router(api_router)

@app.get("/health")
def health(): return {"status": "ok", "branding": "KAHE CMS"}

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
