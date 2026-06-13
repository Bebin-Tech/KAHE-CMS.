import logging
import time
import os
import random
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from . import models, schemas, auth, database
except ImportError:
    import models, schemas, auth, database

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Retry logic for database connection
max_retries = 5
for i in range(max_retries):
    try:
        models.Base.metadata.create_all(bind=database.engine)
        logger.info("Database tables created/verified.")
        break
    except Exception as e:
        if i < max_retries - 1:
            logger.warning(f"Database connection failed (attempt {i+1}/{max_retries}). Retrying in 5s...")
            time.sleep(5)
        else:
            logger.error("Could not connect to database.")
            raise e

# Seeding Logic
def seed_data():
    db = next(database.get_db())
    try:
        # Admin
        admin = db.query(models.User).filter(models.User.role == "admin").first()
        if not admin:
            db.add(models.User(
                name="System Admin", email="admin@kahe.edu",
                password=auth.get_password_hash("admin123"),
                role="admin", faculty_id="admin_01"
            ))
        
        # Working Days
        if db.query(models.WorkingDay).count() == 0:
            for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                db.add(models.WorkingDay(day_name=d, is_working=True))
            db.add(models.WorkingDay(day_name="Saturday", is_working=False))
        
        # Period Timings
        if db.query(models.PeriodTiming).count() == 0:
            periods = [
                (1, "09:00", "09:50", "CLASS"), (2, "09:50", "10:40", "CLASS"),
                (3, "10:40", "11:00", "BREAK"), (4, "11:00", "11:50", "CLASS"),
                (5, "11:50", "12:40", "CLASS"), (6, "12:40", "01:30", "LUNCH"),
                (7, "01:30", "02:20", "CLASS"), (8, "02:20", "03:10", "CLASS"),
                (9, "03:10", "04:00", "CLASS")
            ]
            for p in periods:
                db.add(models.PeriodTiming(
                    period_number=p[0], start_time=p[1], end_time=p[2],
                    is_break=(p[3] != "CLASS"), type=p[3]
                ))
        
        db.commit()
    except Exception as e:
        logger.error(f"Seeding error: {e}")
    finally:
        db.close()

seed_data()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTH APIs ---
@api_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(401, "Invalid institutional credentials")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "user_id": user.id, "name": user.name}

# --- DASHBOARD STATS ---
@api_router.get("/dashboard-stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(database.get_db)):
    return {
        "total_departments": db.query(models.Department).count(),
        "total_programs": db.query(models.Program).count(),
        "total_semesters": db.query(models.Semester).count(),
        "total_subjects": db.query(models.Subject).count(),
        "total_faculties": db.query(models.User).filter(models.User.role == "faculty").count(),
        "total_classrooms": db.query(models.Room).filter(models.Room.type == "Classroom").count(),
        "total_labs": db.query(models.Room).filter(models.Room.type == "Lab").count(),
        "generated_timetables": db.query(models.Timetable).group_by(models.Timetable.semester_id).count(),
        "pending_approvals": db.query(models.Timetable).filter(models.Timetable.status == "PENDING").group_by(models.Timetable.semester_id).count(),
        "approved_timetables": db.query(models.Timetable).filter(models.Timetable.status == "APPROVED").group_by(models.Timetable.semester_id).count(),
        "published_timetables": db.query(models.Timetable).filter(models.Timetable.status == "PUBLISHED").group_by(models.Timetable.semester_id).count(),
        "conflict_alerts": db.query(models.Conflict).filter(models.Conflict.resolved == False).count()
    }

# --- GENERATOR ENGINE ---
@api_router.post("/generate-timetable")
def generate_timetable(semester_id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not semester: raise HTTPException(404, "Semester not found")
    
    subjects = db.query(models.Subject).filter(models.Subject.semester_id == semester_id).all()
    working_days = db.query(models.WorkingDay).filter(models.WorkingDay.is_working == True).all()
    periods = db.query(models.PeriodTiming).filter(models.PeriodTiming.is_break == False).all()
    
    if not subjects: raise HTTPException(400, "No subjects found for this semester")

    db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id, models.Timetable.status.in_(["DRAFT", "PENDING"])).delete()

    for day in working_days:
        for period in periods:
            sub = random.choice(subjects)
            assignment = db.query(models.FacultyAssignment).filter(models.FacultyAssignment.subject_id == sub.id).first()
            faculty_id = assignment.faculty_id if assignment else 1
            room = db.query(models.Room).filter(models.Room.type == ("Lab" if sub.type == "Lab" else "Classroom")).first()
            room_id = room.id if room else 1
            
            clash = db.query(models.Timetable).filter(
                models.Timetable.day_of_week == day.day_name,
                models.Timetable.period_id == period.id,
                or_(models.Timetable.faculty_id == faculty_id, models.Timetable.room_id == room_id)
            ).first()
            
            if not clash:
                db.add(models.Timetable(
                    department_id=semester.program.department_id,
                    program_id=semester.program_id,
                    semester_id=semester_id,
                    day_of_week=day.day_name,
                    period_id=period.id,
                    subject_id=sub.id,
                    faculty_id=faculty_id,
                    room_id=room_id,
                    status="PENDING"
                ))
    db.commit()
    return {"message": "Success! Conflict-free timetable generated."}

# --- SWAP & EDITOR ---
@api_router.post("/swap-slots")
def swap_slots(tt1_id: int, tt2_id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    t1 = db.query(models.Timetable).filter(models.Timetable.id == tt1_id).first()
    t2 = db.query(models.Timetable).filter(models.Timetable.id == tt2_id).first()
    if not t1 or not t2: raise HTTPException(404, "Slot(s) not found")
    t1.subject_id, t2.subject_id = t2.subject_id, t1.subject_id
    t1.faculty_id, t2.faculty_id = t2.faculty_id, t1.faculty_id
    t1.room_id, t2.room_id = t2.room_id, t1.room_id
    db.commit()
    return {"message": "Swapped"}

# --- APPROVAL & PUBLISH ---
@api_router.post("/timetable-approval")
def approve_tt(semester_id: int, status: str, comments: Optional[str] = None, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id).update({"status": status, "approval_comments": comments})
    db.commit()
    return {"message": f"Updated to {status}"}

# --- FACULTY ASSIGNMENT ---
@api_router.post("/faculty-assignments")
def assign_faculty(assign: schemas.FacultyAssignmentBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    existing = db.query(models.FacultyAssignment).filter(models.FacultyAssignment.subject_id == assign.subject_id).first()
    if existing:
        existing.faculty_id = assign.faculty_id
    else:
        db.add(models.FacultyAssignment(**assign.model_dump()))
    db.commit()
    return {"message": "Assigned"}

# --- HELPERS ---
@api_router.get("/timetables", response_model=List[schemas.Timetable])
def list_tt(semester_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    q = db.query(models.Timetable).options(joinedload(models.Timetable.subject), joinedload(models.Timetable.faculty), joinedload(models.Timetable.room), joinedload(models.Timetable.period))
    if semester_id: q = q.filter(models.Timetable.semester_id == semester_id)
    return q.all()

@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def list_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def list_periods(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@api_router.get("/departments", response_model=List[schemas.Department])
def list_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.get("/programs", response_model=List[schemas.Program])
def list_progs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.get("/semesters", response_model=List[schemas.Semester])
def list_sems(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@api_router.get("/subjects", response_model=List[schemas.Subject])
def list_subs(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

@api_router.get("/rooms", response_model=List[schemas.Room])
def list_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db)): return db.query(models.User).all()

@api_router.post("/subjects", response_model=schemas.Subject)
def create_subject(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(**sub.model_dump())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

app.include_router(api_router)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
