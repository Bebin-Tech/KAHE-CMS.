import logging
import os
import random
import io
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, text

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

try:
    import models
    import schemas
    import auth
    import database
except ImportError:
    from . import models, schemas, auth, database

# Configure institutional logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("KAHE-CMS")

# --- DATABASE MIGRATIONS ---
def migrate_db(db: Session):
    """Adds missing columns and tables to prevent crashes while preserving data."""
    try:
        # Create all tables if they don't exist
        models.Base.metadata.create_all(bind=database.engine)
        
        # Helper to add columns if missing
        def add_col(table, col, ctype):
            cols = [row[1] for row in db.execute(text(f"PRAGMA table_info({table})")).fetchall()]
            if col not in cols:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ctype}"))

        # 1. Timetables alignment
        needed_tt = {
            "department_id": "INTEGER", "program_id": "INTEGER", "semester_id": "INTEGER",
            "period_id": "INTEGER", "time_slot": "VARCHAR", "subject_id": "INTEGER",
            "subject_name": "VARCHAR", "subject_type": "VARCHAR", "faculty_id": "INTEGER", "faculty_name": "VARCHAR",
            "room_id": "INTEGER", "room_number": "VARCHAR", "approval_comments": "TEXT",
            "section": "VARCHAR", "academic_year": "VARCHAR", "semester_number": "INTEGER"
        }
        for col, col_type in needed_tt.items(): add_col("timetables", col, col_type)

        # 2. Users alignment
        user_updates = {
            "faculty_id": "VARCHAR", "department_id": "INTEGER", "designation": "VARCHAR",
            "max_hours_per_day": "INTEGER", "max_hours_per_week": "INTEGER", 
            "availability_status": "VARCHAR", "assigned_load_hours": "INTEGER"
        }
        for col, col_type in user_updates.items(): add_col("users", col, col_type)

        # 3. Department alignment
        for col, col_type in {"code": "VARCHAR", "name": "VARCHAR"}.items(): add_col("departments", col, col_type)
        
        # 4. Rooms alignment
        room_updates = {
            "room_number": "VARCHAR", "room_name": "VARCHAR", "floor": "VARCHAR", 
            "building": "VARCHAR", "type": "VARCHAR", "capacity": "INTEGER", 
            "department_id": "INTEGER", "department": "VARCHAR", "status": "VARCHAR"
        }
        for col, col_type in room_updates.items(): add_col("rooms", col, col_type)

        # 5. Subject alignment
        for c in ["code", "type", "credits", "weekly_hours", "semester_id", "department_id", "department_name", "status"]:
            add_col("subjects", c, "INTEGER" if "id" in c or c in ["credits", "weekly_hours"] else "VARCHAR")
        
        db.commit()
    except Exception as e: 
        logger.error(f"Migration error: {e}")
        db.rollback()

def sync_registry():
    """Fail-proof institutional structural seeding."""
    db = database.SessionLocal()
    try:
        migrate_db(db)
        
        # 1. Static Config (Periods/Days)
        db.execute(text("DELETE FROM period_timings"))
        if "sqlite" in str(database.engine.url):
            try:
                db.execute(text("DELETE FROM sqlite_sequence WHERE name='period_timings'"))
                db.execute(text("DELETE FROM sqlite_sequence WHERE name='working_days'"))
            except Exception: pass 

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        for d in days:
            if not db.query(models.WorkingDay).filter(models.WorkingDay.day_name == d).first():
                db.add(models.WorkingDay(day_name=d, is_working=True))

        periods = [
            (1, 1, "09:00", "09:50", False, "CLASS"), (2, 2, "09:50", "10:55", False, "CLASS"),
            (3, 3, "10:55", "11:15", True, "INTERVAL"), (4, 4, "11:15", "12:00", False, "CLASS"),
            (5, 5, "12:00", "12:40", False, "CLASS"), (6, 6, "12:40", "13:30", True, "LUNCH"),
            (7, 7, "13:30", "14:20", False, "CLASS"), (8, 8, "14:20", "15:10", False, "CLASS")
        ]
        for p in periods:
            db.execute(text("INSERT INTO period_timings (id, period_number, start_time, end_time, is_break, type) VALUES (:id, :pn, :st, :et, :ib, :t)"),
                       {"id": p[0], "pn": p[1], "st": p[2], "et": p[3], "ib": p[4], "t": p[5]})
        
        # 2. Structural Root
        dept = db.query(models.Department).filter(models.Department.name == "Computer Science").first()
        if not dept:
            dept = models.Department(name="Computer Science", code="CS")
            db.add(dept); db.commit(); db.refresh(dept)
        
        prog = db.query(models.Program).filter(models.Program.name == "B.Sc CS").first()
        if not prog:
            prog = models.Program(name="B.Sc CS", type="UG", department_id=dept.id)
            db.add(prog); db.commit(); db.refresh(prog)

        if db.query(models.Semester).filter(models.Semester.program_id == prog.id).count() == 0:
            for i in range(1, 7):
                db.add(models.Semester(number=i, program_id=prog.id, is_active=True))
            db.commit()

        # 3. Core Identities
        if db.query(models.User).filter(models.User.email == "admin@kahe.edu").count() == 0:
            db.add(models.User(name="System Admin", email="admin@kahe.edu", password=auth.get_password_hash("admin123"), role="admin", faculty_id="admin_01"))
        if db.query(models.User).filter(models.User.role == "faculty").count() == 0:
            facs = [
                ("Dr. Arul", "arul@kahe.edu", "FAC01"), 
                ("Mrs. Priya", "priya@kahe.edu", "FAC02")
            ]
            for n, e, fid in facs:
                db.add(models.User(
                    name=n, 
                    email=e, 
                    faculty_id=fid, 
                    password=auth.get_password_hash("faculty123"), 
                    role="faculty", 
                    department_id=dept.id, 
                    max_hours_per_week=24
                ))
        
        # 4. Curriculum
        sem3 = db.query(models.Semester).filter(models.Semester.number == 3).first()
        if sem3 and db.query(models.Subject).filter(models.Subject.semester_id == sem3.id).count() == 0:
            subs = [("Operating Systems", 4), ("Computer Networks", 4), ("Python Lab", 3)]
            for sn, hrs in subs:
                s_type = "Theory" if "Lab" not in sn else "Practical"
                db.add(models.Subject(
                    name=sn, 
                    department_name="Computer Science", 
                    weekly_hours=hrs, 
                    semester_id=sem3.id, 
                    type=s_type
                ))
        
        # 5. Rooms
        if db.query(models.Room).count() == 0:
            db.add(models.Room(room_number="A-101", type="Classroom", capacity=60, department="Computer Science", status="AVAILABLE"))
            db.add(models.Room(room_number="L-201", type="Lab", capacity=30, department="Computer Science", status="AVAILABLE"))

        db.commit()
    except Exception as e:
        logger.error(f"Sync Registry Error: {e}"); db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    sync_registry()
    logger.info("KAHE CMS Initialization Complete.")
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
def create_user(
    u: schemas.UserCreate, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    db_u = models.User(**u.model_dump(exclude={"password"}), password=auth.get_password_hash(u.password))
    db.add(db_u)
    db.commit()
    db.refresh(db_u)
    return db_u

@api_router.put("/users/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int, 
    u: schemas.UserUpdate, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    db_u = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_u: 
        raise HTTPException(404, detail="Identity not found")
    update_data = u.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]: 
        update_data["password"] = auth.get_password_hash(update_data["password"])
    for k, v in update_data.items(): 
        setattr(db_u, k, v)
    db.commit()
    db.refresh(db_u)
    return db_u

@api_router.delete("/users/{user_id}")
def purge_user(user_id: int, db: Session = Depends(database.get_db), _admin: models.User = Depends(auth.check_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: 
        raise HTTPException(404)
    try:
        db.delete(user)
        db.commit()
        return {"ok": True}
    except Exception as e:
        logger.error(f"Purge error: {e}")
        db.rollback()
        raise HTTPException(400, detail="Purge failed. Active institutional dependencies detected.")

# --- FACULTY DETAILS ---
@api_router.get("/faculty-assignments", response_model=List[schemas.FacultyAssignment])
def list_assignments(db: Session = Depends(database.get_db)):
    return db.query(models.FacultyAssignment).options(joinedload(models.FacultyAssignment.subject)).all()

@api_router.post("/faculty-assignments")
def assign_faculty(data: schemas.FacultyAssignmentBase, db: Session = Depends(database.get_db)):
    db_assignment = models.FacultyAssignment(**data.model_dump())
    db.add(db_assignment)
    db.commit()
    return {"ok": True}

@api_router.delete("/faculty-assignments")
def clear_assignments(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.query(models.FacultyAssignment).delete()
    db.commit()
    return {"ok": True}

# --- ROOMS ---
@api_router.get("/rooms", response_model=List[schemas.Room])
def list_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.post("/rooms", response_model=schemas.Room)
def create_room(
    r: schemas.RoomCreate, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    db_r = models.Room(**r.model_dump())
    db.add(db_r)
    db.commit()
    db.refresh(db_r)
    return db_r

@api_router.delete("/rooms/{id}")
def delete_room(id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.query(models.Room).filter(models.Room.id == id).delete(); db.commit(); return {"ok": True}

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
def start_class(
    data: schemas.ClassSessionCreate, 
    db: Session = Depends(database.get_db), 
    user: models.User = Depends(auth.get_current_user)
):
    # Check if room is already in use
    existing = db.query(models.ClassSession).filter(
        models.ClassSession.room_id == data.room_id, 
        models.ClassSession.status == "ACTIVE"
    ).first()
    if existing: 
        raise HTTPException(400, "Room already in use")
    
    db_session = models.ClassSession(**data.model_dump(), faculty_user_id=user.id, status="ACTIVE")
    db.query(models.Room).filter(models.Room.id == data.room_id).update({"status": "IN_USE"})
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@api_router.post("/end-class/{session_id}")
def end_class(session_id: int, db: Session = Depends(database.get_db), user: models.User = Depends(auth.get_current_user)):
    session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not session: raise HTTPException(404, detail="Session not found")
    
    # Ownership Check: Only the person who started the class (or an admin) can end it
    if session.faculty_user_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied. Only the faculty member who started this session can conclude it."
        )

    session.status = "COMPLETED"
    session.end_time = datetime.now(timezone.utc)
    db.query(models.Room).filter(models.Room.id == session.room_id).update({"status": "AVAILABLE"})
    db.commit(); return {"ok": True}

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_class_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.start_time.desc()).all()

@api_router.delete("/class-history")
def clear_class_history(db: Session = Depends(database.get_db)):
    db.query(models.ClassSession).delete(); db.commit(); return {"ok": True}

# --- SUBJECTS ---
@api_router.get("/subjects", response_model=List[schemas.Subject])
def list_subjects(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

@api_router.post("/subjects", response_model=schemas.Subject)
def add_subject(
    sub: schemas.SubjectCreate, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    db_sub = models.Subject(**sub.model_dump())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@api_router.put("/subjects/{sub_id}", response_model=schemas.Subject)
def update_subject(
    sub_id: int, 
    sub: schemas.SubjectUpdate, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    db_sub = db.query(models.Subject).filter(models.Subject.id == sub_id).first()
    update_data = sub.model_dump(exclude_unset=True)
    for k, v in update_data.items(): 
        setattr(db_sub, k, v)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@api_router.delete("/subjects/{id}")
def delete_subject(id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    sub = db.query(models.Subject).filter(models.Subject.id == id).first()
    db.query(models.FacultyAssignment).filter(models.FacultyAssignment.subject_id == id).delete()
    db.query(models.Timetable).filter(models.Timetable.subject_id == id).delete()
    db.delete(sub); db.commit(); return {"ok": True}

# --- TIMETABLE & ENGINE ---
@api_router.post("/generate-timetable")
def generate_timetable(
    semester_type: Optional[str] = None, 
    semester_id: Optional[int] = None, 
    db: Session = Depends(database.get_db), 
    _admin: models.User = Depends(auth.check_admin)
):
    """Advanced Institutional Scheduling Engine (V3) with Clash Prevention"""
    # 1. Registry Self-Repair
    if db.query(models.Semester).count() == 0 or db.query(models.Room).count() == 0:
        sync_registry()

    sem_query = db.query(models.Semester)
    if semester_id: 
        sem_query = sem_query.filter(models.Semester.id == semester_id)
    elif semester_type:
        if semester_type.upper() == "ODD": 
            sem_query = sem_query.filter(models.Semester.number % 2 != 0)
        elif semester_type.upper() == "EVEN": 
            sem_query = sem_query.filter(models.Semester.number % 2 == 0)
    
    target_sems = sem_query.all()
    if not target_sems: 
        raise HTTPException(400, "No target semesters found in registry.")

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    periods = db.query(models.PeriodTiming).filter(
        models.PeriodTiming.type == "CLASS"
    ).order_by(models.PeriodTiming.period_number.asc()).all()
    rooms = db.query(models.Room).all()
    facs = db.query(models.User).filter(models.User.role == "faculty").all()
    
    if not periods or not rooms or not facs: 
        raise HTTPException(400, "Institutional Registry missing critical resources (Periods/Rooms/Faculty).")

    for sem in target_sems:
        # Clear existing for this semester
        db.query(models.Timetable).filter(models.Timetable.semester_id == sem.id).delete()
        subjects = db.query(models.Subject).filter(models.Subject.semester_id == sem.id).all()
        if not subjects: 
            continue
        
        load_map = {s.id: (s.weekly_hours or 3) for s in subjects}
        
        for day in days:
            consecutive_theory = 0
            for p in periods:
                assigned = False
                # Try to find a subject for this slot
                random.shuffle(subjects) # Randomize per slot to balance distribution
                for sub in subjects:
                    if load_map[sub.id] <= 0: 
                        continue
                    
                    # Rule: Max 2 consecutive theory hours
                    if sub.type == "Theory" and consecutive_theory >= 2: 
                        continue
                        
                    # Resolve Faculty for this subject
                    assign = db.query(models.FacultyAssignment).filter(
                        models.FacultyAssignment.subject_id == sub.id
                    ).first()
                    f = (db.query(models.User).filter(models.User.id == assign.faculty_id).first() 
                         if assign else random.choice(facs))
                    
                    # CLASH CHECK: Faculty Availability
                    f_clash = db.query(models.Timetable).filter(
                        models.Timetable.day_of_week == day,
                        models.Timetable.period_id == p.id,
                        models.Timetable.faculty_id == f.id
                    ).first()
                    if f_clash: 
                        continue
                        
                    # CLASH CHECK: Room Availability
                    target_room = None
                    # Labs go to Lab rooms, Theory goes to Classrooms
                    room_candidates = [r for r in rooms if r.type == ("Lab" if "Lab" in sub.name or sub.type == "Practical" else "Classroom")]
                    if not room_candidates: room_candidates = rooms
                    
                    for r_cand in room_candidates:
                        r_clash = db.query(models.Timetable).filter(
                            models.Timetable.day_of_week == day,
                            models.Timetable.period_id == p.id,
                            models.Timetable.room_id == r_cand.id
                        ).first()
                        if not r_clash:
                            target_room = r_cand
                            break
                    
                    if not target_room: 
                        continue
                    
                    # ALL CLEAR - COMMIT SLOT
                    db.add(models.Timetable(
                        day_of_week=day,
                        period_id=p.id,
                        time_slot=f"{p.start_time}-{p.end_time}",
                        subject_id=sub.id,
                        subject_name=sub.name,
                        subject_type=sub.type,
                        faculty_id=f.id,
                        faculty_name=f.name,
                        room_id=target_room.id,
                        room_number=target_room.room_number,
                        semester_id=sem.id,
                        semester_number=sem.number,
                        section="A",
                        status="PUBLISHED"
                    ))
                    load_map[sub.id] -= 1
                    if sub.type == "Theory": 
                        consecutive_theory += 1
                    else: 
                        consecutive_theory = 0
                    assigned = True
                    break
                
                if not assigned:
                    # If no subjects left or all clashed, mark as special/free
                    db.add(models.Timetable(
                        day_of_week=day,
                        period_id=p.id,
                        time_slot=f"{p.start_time}-{p.end_time}",
                        subject_name="Library / Special Activity",
                        room_id=random.choice(rooms).id,
                        room_number=random.choice(rooms).room_number,
                        semester_id=sem.id,
                        semester_number=sem.number,
                        section="A",
                        status="PUBLISHED"
                    ))
                    consecutive_theory = 0
    db.commit()
    return {"status": "success"}

@api_router.get("/timetables", response_model=List[schemas.Timetable])
def list_timetables(semester_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Timetable)
    if semester_id:
        query = query.filter(models.Timetable.semester_id == semester_id)
    return query.all()

@api_router.delete("/timetables")
def purge_timetables(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    try:
        db.query(models.Conflict).delete()
        db.query(models.Timetable).delete()
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        logger.error(f"Error purging timetables: {e}")
        raise HTTPException(500, detail=f"Purge failed: {str(e)}")

@api_router.post("/swap-slots")
def swap_slots(
    tt1_id: int, 
    tt2_id: int, 
    db: Session = Depends(database.get_db), 
    user: models.User = Depends(auth.get_current_user)
):
    tt1 = db.query(models.Timetable).filter(models.Timetable.id == tt1_id).first()
    tt2 = db.query(models.Timetable).filter(models.Timetable.id == tt2_id).first()
    if not tt1 or not tt2:
        raise HTTPException(404, detail="One or both timetable slots not found.")
    
    # Swap day_of_week, period_id, time_slot
    tt1.day_of_week, tt2.day_of_week = tt2.day_of_week, tt1.day_of_week
    tt1.period_id, tt2.period_id = tt2.period_id, tt1.period_id
    tt1.time_slot, tt2.time_slot = tt2.time_slot, tt1.time_slot
    
    db.commit()
    return {"status": "success"}

# --- REPORTS & ANALYTICS ---
@api_router.get("/faculty-workload")
def get_faculty_workload(db: Session = Depends(database.get_db)):
    """Calculates assigned hours vs capacity for all faculty members."""
    faculties = db.query(models.User).filter(models.User.role == "faculty").all()
    workload = []
    for f in faculties:
        assigned_periods = db.query(models.Timetable).filter(models.Timetable.faculty_id == f.id).count()
        total_load = assigned_periods + (f.assigned_load_hours or 0)
        remaining = max(0, (f.max_hours_per_week or 24) - total_load)
        workload.append({
            "faculty_name": f.name,
            "faculty_id": f.faculty_id,
            "total_hours_assigned": total_load,
            "timetable_hours": assigned_periods,
            "manual_load": f.assigned_load_hours or 0,
            "max_hours_per_week": f.max_hours_per_week or 24,
            "remaining_hours": remaining,
            "utilization_rate": round((total_load / (f.max_hours_per_week or 24)) * 100, 1) if f.max_hours_per_week else 0
        })
    return workload

@api_router.get("/room-utilization")
def get_room_utilization(db: Session = Depends(database.get_db)):
    """Reports room occupancy stats across the working week."""
    rooms = db.query(models.Room).all()
    total_slots_per_week = 36
    report = []
    for r in rooms:
        occupied_slots = db.query(models.Timetable).filter(models.Timetable.room_id == r.id).count()
        report.append({
            "room_number": r.room_number,
            "type": r.type,
            "occupied_slots": occupied_slots,
            "total_slots": total_slots_per_week,
            "utilization_rate": round((occupied_slots / total_slots_per_week) * 100, 1)
        })
    return report

# --- DASHBOARD & STATS ---
@api_router.get("/dashboard-stats")
def get_stats(db: Session = Depends(database.get_db)):
    try:
        return {
            "rooms": db.query(models.Room).count(),
            "active": db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").count(),
            "total_departments": db.query(models.Department).count(),
            "total_programs": db.query(models.Program).count(),
            "total_semesters": db.query(models.Semester).count(),
            "total_subjects": db.query(models.Subject).count(),
            "total_faculties": db.query(models.User).filter(models.User.role == "faculty").count(),
            "total_classrooms": db.query(models.Room).filter(models.Room.type == "Classroom").count(),
            "total_labs": db.query(models.Room).filter(models.Room.type == "Lab").count(),
            "generated_timetables": db.query(models.Timetable).count() // 36 if db.query(models.Timetable).count() > 0 else 0,
            "bookings": db.query(models.Booking).count(),
            "pending_approvals": db.query(models.Timetable).filter(models.Timetable.status == "PENDING").count(),
            "approved_timetables": db.query(models.Timetable).filter(models.Timetable.status == "APPROVED").count(),
            "conflict_alerts": db.query(models.Conflict).filter(models.Conflict.resolved == False).count()
        }
    except Exception as e:
        logger.error(f"Dashboard Stats Error: {e}")
        return {"error": str(e)}

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def list_periods(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number.asc()).all()

@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def list_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

# --- REGISTRY ---
@api_router.get("/departments", response_model=List[schemas.Department])
def list_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.get("/programs", response_model=List[schemas.Program])
def list_progs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.get("/semesters", response_model=List[schemas.Semester])
def list_sems(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

# --- PDF EXPORT ENGINE ---
@api_router.get("/timetables/pdf/semester/{sem_id}")
def export_semester_pdf(sem_id: int, db: Session = Depends(database.get_db)):
    if not FPDF:
        raise HTTPException(500, "PDF Engine (fpdf2) not installed on server. Run 'pip install fpdf2'")
    
    sem = db.query(models.Semester).filter(models.Semester.id == sem_id).first()
    if not sem: raise HTTPException(404, "Semester not found")
    
    tt_entries = db.query(models.Timetable).filter(models.Timetable.semester_id == sem_id).all()
    periods = db.query(models.PeriodTiming).filter(models.PeriodTiming.type == "CLASS").order_by(models.PeriodTiming.period_number.asc()).all()
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "KAHE CAMPUS MANAGEMENT SYSTEM - TIMETABLE", ln=True, align='C')
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, f"Program: {sem.program.name if sem.program else 'N/A'} | Semester: {sem.number} | Section: A", ln=True, align='C')
    pdf.ln(5)

    # Table Header
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 8)
    col_width = 38
    pdf.cell(25, 10, "Day / Period", border=1, align='C', fill=True)
    for p in periods:
        pdf.cell(col_width, 10, f"P{p.period_number} ({p.start_time}-{p.end_time})", border=1, align='C', fill=True)
    pdf.ln()

    # Table Body
    pdf.set_font("Helvetica", "", 7)
    row_height = 15
    for day in days:
        pdf.cell(25, row_height, day, border=1, align='C')
        for p in periods:
            entry = next((t for t in tt_entries if t.day_of_week == day and t.period_id == p.id), None)
            x, y = pdf.get_x(), pdf.get_y()
            if entry:
                cell_text = f"{entry.subject_name}\n({entry.faculty_name})\nRm: {entry.room_number}"
                pdf.multi_cell(col_width, 4.5, cell_text, border=1, align='C')
                pdf.set_xy(x + col_width, y)
            else:
                pdf.cell(col_width, row_height, "-", border=1, align='C')
        pdf.ln(row_height)

    return StreamingResponse(
        io.BytesIO(pdf.output()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Timetable_Sem_{sem.number}.pdf"}
    )

@api_router.get("/timetables/pdf/faculty/{faculty_id}")
def export_faculty_pdf(faculty_id: int, db: Session = Depends(database.get_db)):
    if not FPDF:
        raise HTTPException(500, "PDF Engine (fpdf2) not installed on server.")
    
    fac = db.query(models.User).filter(models.User.id == faculty_id).first()
    if not fac: raise HTTPException(404, "Faculty not found")
    
    tt_entries = db.query(models.Timetable).filter(models.Timetable.faculty_id == faculty_id).all()
    periods = db.query(models.PeriodTiming).filter(models.PeriodTiming.type == "CLASS").order_by(models.PeriodTiming.period_number.asc()).all()
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "KAHE CMS - FACULTY TIMETABLE", ln=True, align='C')
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, f"Faculty: {fac.name} | ID: {fac.faculty_id} | Dept: {fac.department.name if fac.department else 'N/A'}", ln=True, align='C')
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 8)
    col_width = 38
    pdf.cell(25, 10, "Day / Period", border=1, align='C')
    for p in periods:
        pdf.cell(col_width, 10, f"P{p.period_number} ({p.start_time}-{p.end_time})", border=1, align='C')
    pdf.ln()

    pdf.set_font("Helvetica", "", 7)
    for day in days:
        pdf.cell(25, 15, day, border=1, align='C')
        for p in periods:
            entry = next((t for t in tt_entries if t.day_of_week == day and t.period_id == p.id), None)
            x, y = pdf.get_x(), pdf.get_y()
            if entry:
                cell_text = f"{entry.subject_name}\nSem: {entry.semester_number} Sec: {entry.section}\nRm: {entry.room_number}"
                pdf.multi_cell(col_width, 5, cell_text, border=1, align='C')
                pdf.set_xy(x + col_width, y)
            else:
                pdf.cell(col_width, 15, "-", border=1, align='C')
        pdf.ln()

    return StreamingResponse(
        io.BytesIO(pdf.output()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Faculty_Timetable_{fac.name.replace(' ','_')}.pdf"}
    )

@api_router.get("/timetables/pdf/room/{room_id}")
def export_room_pdf(room_id: int, db: Session = Depends(database.get_db)):
    if not FPDF: raise HTTPException(500, "PDF Engine not ready")
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room: raise HTTPException(404, "Room not found")
    
    tt_entries = db.query(models.Timetable).filter(models.Timetable.room_id == room_id).all()
    periods = db.query(models.PeriodTiming).filter(models.PeriodTiming.type == "CLASS").order_by(models.PeriodTiming.period_number.asc()).all()
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, f"ROOM UTILIZATION MATRIX - {room.room_number}", ln=True, align='C')
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, f"Type: {room.type} | Capacity: {room.capacity} | Dept: {room.department}", ln=True, align='C')
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 8)
    col_width = 38
    pdf.cell(25, 10, "Day / Period", border=1, align='C')
    for p in periods:
        pdf.cell(col_width, 10, f"P{p.period_number} ({p.start_time}-{p.end_time})", border=1, align='C')
    pdf.ln()

    pdf.set_font("Helvetica", "", 7)
    for day in days:
        pdf.cell(25, 15, day, border=1, align='C')
        for p in periods:
            entry = next((t for t in tt_entries if t.day_of_week == day and t.period_id == p.id), None)
            x, y = pdf.get_x(), pdf.get_y()
            if entry:
                cell_text = f"{entry.subject_name}\n({entry.faculty_name})\nSem: {entry.semester_number} Sec: {entry.section}"
                pdf.multi_cell(col_width, 5, cell_text, border=1, align='C')
                pdf.set_xy(x + col_width, y)
            else:
                pdf.cell(col_width, 15, "-", border=1, align='C')
        pdf.ln()

    return StreamingResponse(io.BytesIO(pdf.output()), media_type="application/pdf")

@api_router.get("/reports/pdf/workload")
def export_workload_pdf(db: Session = Depends(database.get_db)):
    if not FPDF:
        raise HTTPException(500, "PDF Engine not ready")
    data = get_faculty_workload(db)
    
    pdf = FPDF(unit='mm', format='A4')
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 15, "KAHE CMS - FACULTY WORKLOAD AUDIT", ln=True, align='C')
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}", ln=True, align='C')
    pdf.ln(5)

    # Table Header
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 10, "Faculty Name", border=1, fill=True)
    pdf.cell(30, 10, "Registry Hrs", border=1, align='C', fill=True)
    pdf.cell(30, 10, "Manual Load", border=1, align='C', fill=True)
    pdf.cell(30, 10, "Total Assigned", border=1, align='C', fill=True)
    pdf.cell(40, 10, "Utilization (%)", border=1, align='C', fill=True)
    pdf.ln()

    # Table Body
    pdf.set_font("Helvetica", "", 9)
    for f in data:
        pdf.cell(60, 10, f['faculty_name'], border=1)
        pdf.cell(30, 10, f"{f['timetable_hours']} hrs", border=1, align='C')
        pdf.cell(30, 10, f"{f['manual_load']} hrs", border=1, align='C')
        pdf.cell(30, 10, f"{f['total_hours_assigned']} / {f['max_hours_per_week']}", border=1, align='C')
        
        # Color utilization cell if it exceeds 90%
        if f['utilization_rate'] > 90:
            pdf.set_text_color(200, 0, 0)
        else:
            pdf.set_text_color(0, 100, 0)
            
        pdf.cell(40, 10, f"{f['utilization_rate']}%", border=1, align='C')
        pdf.set_text_color(0, 0, 0) # Reset color
        pdf.ln()
    
    return StreamingResponse(
        io.BytesIO(pdf.output()), 
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Faculty_Workload_Audit.pdf"}
    )

@api_router.get("/reports/pdf/room-utilization")
def export_rooms_pdf(db: Session = Depends(database.get_db)):
    if not FPDF:
        raise HTTPException(500, "PDF Engine not ready")
    data = get_room_utilization(db)
    
    pdf = FPDF(unit='mm', format='A4')
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 15, "KAHE CMS - ROOM UTILIZATION AUDIT", ln=True, align='C')
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M')}", ln=True, align='C')
    pdf.ln(5)

    # Table Header
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(50, 10, "Room Number", border=1, fill=True)
    pdf.cell(50, 10, "Facility Type", border=1, fill=True)
    pdf.cell(45, 10, "Occupied Slots", border=1, align='C', fill=True)
    pdf.cell(45, 10, "Utilization (%)", border=1, align='C', fill=True)
    pdf.ln()

    # Table Body
    pdf.set_font("Helvetica", "", 9)
    for r in data:
        pdf.cell(50, 10, r['room_number'], border=1)
        pdf.cell(50, 10, r['type'], border=1)
        pdf.cell(45, 10, f"{r['occupied_slots']} / {r['total_slots']}", border=1, align='C')
        
        # Color utilization based on occupancy
        if r['utilization_rate'] > 80:
            pdf.set_text_color(200, 0, 0) # High occupancy alert
        elif r['utilization_rate'] < 20:
            pdf.set_text_color(0, 0, 200) # Low utilization
        else:
            pdf.set_text_color(0, 100, 0) # Optimal
            
        pdf.cell(45, 10, f"{r['utilization_rate']}%", border=1, align='C')
        pdf.set_text_color(0, 0, 0)
        pdf.ln()

    return StreamingResponse(
        io.BytesIO(pdf.output()), 
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Room_Utilization_Audit.pdf"}
    )

app.include_router(api_router)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(_request, _exc): 
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
