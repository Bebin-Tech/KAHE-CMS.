import logging
import os
import random
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from . import models, schemas, auth, database
except ImportError:
    import models, schemas, auth, database

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure tables are created
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("Database tables verified.")
except Exception as e:
    logger.error(f"Database creation failed: {e}")

# Robust Seeding Logic
def seed_data():
    db = database.SessionLocal()
    try:
        logger.info("Synchronizing institutional credentials...")
        
        # 1. Seed Users (Admin, HOD, Faculty)
        users_to_seed = [
            ("Admin User", "admin@kahe.edu", "admin123", "admin", "admin_01"),
            ("HOD User", "hod@kahe.edu", "hod123", "hod", "hod_01"),
            ("bebin", "bebin@kahe.edu", "faculty123", "faculty", "fac_01"),
            ("deepak", "deepak@kahe.edu", "faculty123", "faculty", "fac_02"),
            ("jeya", "jeya@kahe.edu", "faculty123", "faculty", "fac_03")
        ]
        
        for name, email, pwd, role, f_id in users_to_seed:
            hashed_pwd = auth.get_password_hash(pwd)
            # Find by email first
            user = db.query(models.User).filter(models.User.email == email).first()
            
            if not user:
                # If not found by email, try faculty_id
                user = db.query(models.User).filter(models.User.faculty_id == f_id).first()
            
            if not user:
                new_user = models.User(
                    name=name, email=email, password=hashed_pwd, 
                    role=role, faculty_id=f_id
                )
                db.add(new_user)
                logger.info(f"Created system account: {email}")
            else:
                # Force password update to ensure it matches the seeding
                user.password = hashed_pwd
                user.role = role
                user.name = name
                user.email = email
                user.faculty_id = f_id
                logger.info(f"Synchronized system account: {email}")
        
        db.commit()

        # 2. Seed Departments if empty
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)", "General", "Physics"]:
                db.add(models.Department(name=d))
            db.commit()
            logger.info("Institutional departments synchronized.")

        # 3. Seed Rooms if empty
        if db.query(models.Room).count() == 0:
            rooms_data = [
                ("B-205", "Lab", 30, "Physics", "AVAILABLE", "Physics Lab", "2", "B Block"),
                ("S-01", "Seminar Hall", 200, "General", "AVAILABLE", "Seminar Hall 1", "G", "S Block"),
                ("C-302", "Office", 2, "Mathematics", "AVAILABLE", "Math Office", "3", "C Block"),
            ]
            for floor in ["2", "3", "4"]:
                for i in range(1, 21):
                    r_num = f"S-{floor}{str(i).zfill(2)}"
                    rooms_data.append((r_num, "Classroom", 60, "General", "AVAILABLE", f"Room {r_num}", floor, "S Block"))
            
            rooms_data.extend([
                ("s-500", "Classroom", 800, "Computer Science", "AVAILABLE", "Mega Class", "6", "S Block"),
                ("s-900", "Classroom", 650, "Computer Science", "AVAILABLE", "Grand Hall", "7", "S-Block")
            ])

            for r in rooms_data:
                dept_name = r[3]
                dept = db.query(models.Department).filter(models.Department.name == dept_name).first()
                db.add(models.Room(
                    room_number=r[0], type=r[1], capacity=r[2],
                    department_id=dept.id if dept else None,
                    status=r[4], room_name=r[5], floor=r[6], building=r[7]
                ))
            db.commit()
            logger.info("Rooms synchronized.")

        logger.info("Institutional data synchronization complete.")
    except Exception as e:
        logger.error(f"Critical Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

# Run seed
seed_data()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@api_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    logger.info(f"Attempting login for: {form_data.username}")
    
    # Try finding user by email OR faculty_id (institutional ID)
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(form_data.username), 
            models.User.faculty_id == form_data.username
        )
    ).first()
    
    if not user:
        logger.warning(f"Login rejected: User '{form_data.username}' not found.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid institutional credentials. Account not found."
        )
    
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Login rejected: Password mismatch for user '{user.email}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid institutional credentials. Incorrect password."
        )
    
    logger.info(f"Login granted: {user.email} (Role: {user.role})")
    
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- STATS ---
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
        "conflict_alerts": 0
    }

# --- DIRECTORY ---
@api_router.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)):
    return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

@api_router.get("/room-history/{room_id}", response_model=List[schemas.ClassSession])
def get_room_history(room_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id).order_by(models.ClassSession.id.desc()).all()

@api_router.get("/active-sessions", response_model=List[schemas.ClassSession])
def get_active_sessions(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").all()

@api_router.get("/active-session/{room_id}", response_model=Optional[schemas.ClassSession])
def get_active_room_session(room_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id, models.ClassSession.status == "ACTIVE").first()

# --- HELPERS ---
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

@api_router.post("/subjects", response_model=schemas.Subject)
def create_sub(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(**sub.model_dump())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@api_router.post("/faculty-assignments")
def assign_f(assign: schemas.FacultyAssignmentBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.add(models.FacultyAssignment(**assign.model_dump()))
    db.commit()
    return {"message": "Assigned"}

@api_router.post("/generate-timetable")
def gen_tt(semester_id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return {"message": "Success"}

app.include_router(api_router)

# Serve Frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
