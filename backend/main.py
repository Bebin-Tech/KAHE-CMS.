import logging
import time
import os
import random
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
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

# Retry logic for database connection during startup
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
            logger.error("Could not connect to database after several attempts.")
            raise e

# Auto-seed admin user
def seed_admin():
    db = next(database.get_db())
    try:
        admin = db.query(models.User).filter(models.User.role == "admin").first()
        if not admin:
            hashed_password = auth.get_password_hash("admin123")
            admin_user = models.User(
                name="System Admin",
                email="admin@kahe.edu",
                password=hashed_password,
                role="admin",
                faculty_id="admin_01"
            )
            db.add(admin_user)
            db.commit()
            logger.info("Default admin user created.")
    except Exception as e:
        logger.error(f"Seeding error: {e}")
    finally:
        db.close()

seed_admin()

# Auto-seed academic settings if empty
def seed_timetable_settings():
    db = next(database.get_db())
    try:
        if db.query(models.WorkingDay).count() == 0:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
            for d in days:
                db.add(models.WorkingDay(day_name=d, is_working=True))
            logger.info("Default working days seeded.")
        
        if db.query(models.PeriodTiming).count() == 0:
            periods = [
                (1, "09:00", "09:50"), (2, "09:50", "10:40"), (3, "11:00", "11:50"),
                (4, "11:50", "12:40"), (5, "01:30", "02:20"), (6, "02:20", "03:10")
            ]
            for p in periods:
                db.add(models.PeriodTiming(period_number=p[0], start_time=p[1], end_time=p[2]))
            logger.info("Default period timings seeded.")
        
        db.commit()
    except Exception as e:
        logger.error(f"Seeding settings error: {e}")
    finally:
        db.close()

seed_timetable_settings()

app = FastAPI(
    title="KAHE Campus Management System",
    description="Optimized backend for real-time classroom tracking and management."
)

api_router = APIRouter(prefix="/api")

# Middlewares
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@api_router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed_password = auth.get_password_hash(user.password)
        role = user.role if user.role in ["faculty", "student"] else "student"
        db_user = models.User(
            name=user.name,
            email=user.email,
            password=hashed_password,
            role=role,
            faculty_id=user.faculty_id
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during registration.")

@api_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    try:
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        if not user or not auth.verify_password(form_data.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "role": user.role,
            "user_id": user.id,
            "name": user.name
        }
    except SQLAlchemyError as e:
        logger.error(f"Database error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during login.")

# Room APIs
@api_router.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)):
    return db.query(models.Room).all()

@api_router.post("/rooms", response_model=schemas.Room)
def create_room(room: schemas.RoomCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_room = models.Room(**room.dict())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

# Dashboard Stats API
@api_router.get("/dashboard-stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    return {
        "total_departments": db.query(models.Department).count(),
        "total_programs": db.query(models.Program).count(),
        "total_semesters": db.query(models.Semester).count(),
        "total_subjects": db.query(models.Subject).count(),
        "total_faculties": db.query(models.User).filter(models.User.role == "faculty").count(),
        "total_classrooms": db.query(models.Room).filter(models.Room.type == "Classroom").count(),
        "total_labs": db.query(models.Room).filter(models.Room.type == "Lab").count(),
        "generated_timetables": db.query(models.Timetable).count(),
        "pending_approvals": db.query(models.Timetable).filter(models.Timetable.status == "PENDING").count(),
        "approved_timetables": db.query(models.Timetable).filter(models.Timetable.status == "APPROVED").count(),
        "conflict_alerts": 0 # Logic for conflicts can be added here
    }

# Program & Semester APIs
@api_router.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(database.get_db)):
    return db.query(models.Department).all()

@api_router.post("/departments", response_model=schemas.Department)
def create_department(dept: schemas.DepartmentBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_dept = models.Department(name=dept.name)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

@api_router.get("/programs", response_model=List[schemas.Program])
def get_programs(db: Session = Depends(database.get_db)):
    return db.query(models.Program).all()

@api_router.post("/programs", response_model=schemas.Program)
def create_program(prog: schemas.ProgramBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_prog = models.Program(**prog.dict())
    db.add(db_prog)
    db.commit()
    db.refresh(db_prog)
    return db_prog

@api_router.get("/semesters", response_model=List[schemas.Semester])
def get_semesters(db: Session = Depends(database.get_db)):
    return db.query(models.Semester).all()

@api_router.post("/semesters", response_model=schemas.Semester)
def create_semester(sem: schemas.SemesterBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_sem = models.Semester(**sem.dict())
    db.add(db_sem)
    db.commit()
    db.refresh(db_sem)
    return db_sem

# Subject APIs
@api_router.get("/subjects", response_model=List[schemas.Subject])
def get_subjects(db: Session = Depends(database.get_db)):
    return db.query(models.Subject).all()

@api_router.post("/subjects", response_model=schemas.Subject)
def create_subject(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(**sub.dict())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@api_router.put("/subjects/{subject_id}", response_model=schemas.Subject)
def update_subject(subject_id: int, sub_update: schemas.SubjectBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not db_sub: raise HTTPException(404, "Subject not found")
    for key, value in sub_update.dict().items():
        setattr(db_sub, key, value)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@api_router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not db_sub: raise HTTPException(404, "Subject not found")
    db.delete(db_sub)
    db.commit()
    return {"message": "Subject deleted"}

# Academic Settings APIs
@api_router.get("/academic-settings", response_model=List[schemas.AcademicSetting])
def get_academic_settings(db: Session = Depends(database.get_db)):
    return db.query(models.AcademicSetting).all()

@api_router.post("/academic-settings", response_model=schemas.AcademicSetting)
def create_academic_setting(setting: schemas.AcademicSettingBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db.query(models.AcademicSetting).update({"is_active": False})
    db_setting = models.AcademicSetting(**setting.dict(), is_active=True)
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def get_working_days(db: Session = Depends(database.get_db)):
    return db.query(models.WorkingDay).all()

@api_router.post("/working-days", response_model=schemas.WorkingDay)
def create_working_day(wd: schemas.WorkingDayBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_wd = models.WorkingDay(**wd.dict())
    db.add(db_wd)
    db.commit()
    db.refresh(db_wd)
    return db_wd

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def get_period_timings(db: Session = Depends(database.get_db)):
    return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@api_router.post("/period-timings", response_model=schemas.PeriodTiming)
def create_period_timing(pt: schemas.PeriodTimingBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_pt = models.PeriodTiming(**pt.dict())
    db.add(db_pt)
    db.commit()
    db.refresh(db_pt)
    return db_pt

# Timetable Generation Logic
@api_router.post("/generate-timetable")
def generate_timetable(semester_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
        if not semester: raise HTTPException(404, "Semester not found")
        
        subjects = db.query(models.Subject).filter(models.Subject.semester_id == semester_id).all()
        working_days = db.query(models.WorkingDay).filter(models.WorkingDay.is_working == True).all()
        periods = db.query(models.PeriodTiming).filter(models.PeriodTiming.is_break == False).all()
        rooms = db.query(models.Room).filter(models.Room.type == "Classroom").all() # Simplified
        faculties = db.query(models.User).filter(models.User.role == "faculty").all()

        if not subjects or not working_days or not periods:
            raise HTTPException(400, "Incomplete settings (subjects, days, or periods missing)")

        # Clear existing pending/approved for this semester before generating new
        db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id).delete()

        # Simple greedy algorithm for generation (Demo purposes)
        # In a real system, this would be more complex with constraints
        for day in working_days:
            for period in periods:
                subject = random.choice(subjects)
                faculty = random.choice(faculties)
                room = random.choice(rooms)
                
                db_tt = models.Timetable(
                    department_id=semester.program.department_id,
                    program_id=semester.program_id,
                    semester_id=semester_id,
                    day_of_week=day.day_name,
                    period_id=period.id,
                    subject_id=subject.id,
                    faculty_id=faculty.id,
                    room_id=room.id,
                    status="PENDING"
                )
                db.add(db_tt)
        
        db.commit()
        return {"message": f"Timetable generated for Semester {semester.number}"}
    except Exception as e:
        db.rollback()
        logger.error(f"Generation error: {e}")
        raise HTTPException(500, str(e))

@api_router.get("/timetables", response_model=List[schemas.Timetable])
def get_timetables(semester_id: Optional[int] = None, department_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Timetable).options(
        joinedload(models.Timetable.subject),
        joinedload(models.Timetable.faculty),
        joinedload(models.Timetable.room),
        joinedload(models.Timetable.period)
    )
    if semester_id: query = query.filter(models.Timetable.semester_id == semester_id)
    if department_id: query = query.filter(models.Timetable.department_id == department_id)
    return query.all()

@api_router.post("/approve-timetable/{semester_id}")
def approve_timetable(semester_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id).update({"status": "APPROVED"})
    db.commit()
    return {"message": "Timetable approved"}

# Include API Router
app.include_router(api_router)

# Serve Frontend Static Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
