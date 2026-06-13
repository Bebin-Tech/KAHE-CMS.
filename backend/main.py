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
        logger.info("Starting institutional account synchronization...")
        
        # 1. Unified User List
        users_to_seed = [
            ("System Administrator", "admin@kahe.edu", "admin123", "admin", "admin_01"),
            ("HOD Computer Science", "hod@kahe.edu", "hod123", "hod", "hod_01"),
            ("General Faculty", "faculty@kahe.edu", "faculty123", "faculty", "fac_00"),
            ("bebin", "bebin@kahe.edu", "faculty123", "faculty", "fac_01"),
            ("deepak", "deepak@kahe.edu", "faculty123", "faculty", "fac_02"),
            ("jeya", "jeya@kahe.edu", "faculty123", "faculty", "fac_03")
        ]
        
        for name, email, pwd, role, f_id in users_to_seed:
            hashed_pwd = auth.get_password_hash(pwd)
            # Find existing user by email
            user = db.query(models.User).filter(models.User.email == email).first()
            
            if not user:
                # Fallback check by faculty_id
                user = db.query(models.User).filter(models.User.faculty_id == f_id).first()
            
            if not user:
                db.add(models.User(
                    name=name, email=email, password=hashed_pwd, 
                    role=role, faculty_id=f_id
                ))
                logger.info(f"Seeded account: {email}")
            else:
                # Force update password and metadata to ensure correct access
                user.password = hashed_pwd
                user.role = role
                user.name = name
                user.faculty_id = f_id
                logger.info(f"Synchronized account: {email}")
        
        db.commit()

        # 2. Seed Departments
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)", "General", "Physics"]:
                db.add(models.Department(name=d))
            db.commit()
            logger.info("Departments seeded.")

        # 3. Seed Rooms
        if db.query(models.Room).count() == 0:
            rooms_data = [
                ("B-205", "Lab", 30, "Physics", "AVAILABLE", "Physics Lab", "2", "B Block"),
                ("S-01", "Seminar Hall", 200, "General", "AVAILABLE", "Seminar Hall 1", "G", "S Block"),
                ("C-302", "Office", 2, "Mathematics", "AVAILABLE", "Math Office", "3", "C Block"),
            ]
            for floor in ["2", "3", "4"]:
                for i in range(1, 11):
                    r_num = f"S-{floor}{str(i).zfill(2)}"
                    rooms_data.append((r_num, "Classroom", 60, "General", "AVAILABLE", f"Room {r_num}", floor, "S Block"))
            
            rooms_data.extend([
                ("s-500", "Classroom", 800, "Computer Science", "AVAILABLE", "Mega Class", "6", "S Block"),
                ("s-900", "Classroom", 650, "Computer Science", "AVAILABLE", "Grand Hall", "7", "S-Block")
            ])

            for r in rooms_data:
                dept = db.query(models.Department).filter(models.Department.name == r[3]).first()
                db.add(models.Room(
                    room_number=r[0], type=r[1], capacity=r[2],
                    department_id=dept.id if dept else None,
                    status=r[4], room_name=r[5], floor=r[6], building=r[7]
                ))
            db.commit()
            logger.info("Room directory seeded.")

        logger.info("Institutional data synchronization complete.")
    except Exception as e:
        logger.error(f"Critical Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

# Initial database setup
seed_data()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- AUTHENTICATION ---
@api_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    logger.info(f"Login attempt for: {form_data.username}")
    
    # Authenticate via Email OR Faculty ID
    user = db.query(models.User).filter(
        or_(models.User.email == form_data.username, models.User.faculty_id == form_data.username)
    ).first()
    
    if not user or not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Failed login attempt for: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid institutional credentials. Please try again."
        )
    
    logger.info(f"Successful login: {user.email} (Role: {user.role})")
    
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- MODULES & DATA ---
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

@api_router.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)):
    return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

@api_router.get("/active-sessions", response_model=List[schemas.ClassSession])
def get_active_sessions(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").all()

@api_router.get("/active-session/{room_id}", response_model=Optional[schemas.ClassSession])
def get_active_room_session(room_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id, models.ClassSession.status == "ACTIVE").first()

app.include_router(api_router)

# --- FRONTEND SERVING ---
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
