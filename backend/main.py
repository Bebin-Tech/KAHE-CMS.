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
    logger.info("Institutional database schema verified.")
except Exception as e:
    logger.error(f"Critical Database error: {e}")

# Robust Institutional Seeding
def seed_institutional_data():
    db = database.SessionLocal()
    try:
        logger.info("Initializing institutional security layer...")
        
        # 1. Definitive Admin Account
        admin_data = {
            "name": "System Administrator",
            "email": "admin@kahe.edu",
            "password": "admin123",
            "role": "admin",
            "faculty_id": "admin_01"
        }
        
        # Aggressive sync: ensure no conflicts with the definitive admin
        hashed_pwd = auth.get_password_hash(admin_data["password"])
        
        # Search for any user that might conflict with admin email or ID
        existing = db.query(models.User).filter(
            or_(
                models.User.email == admin_data["email"],
                models.User.faculty_id == admin_data["faculty_id"]
            )
        ).first()
        
        if existing:
            existing.email = admin_data["email"]
            existing.faculty_id = admin_data["faculty_id"]
            existing.password = hashed_pwd
            existing.role = admin_data["role"]
            existing.name = admin_data["name"]
            logger.info(f"Administrator account synchronized: {admin_data['email']}")
        else:
            db.add(models.User(
                name=admin_data["name"],
                email=admin_data["email"],
                password=hashed_pwd,
                role=admin_data["role"],
                faculty_id=admin_data["faculty_id"]
            ))
            logger.info(f"Administrator account created: {admin_data['email']}")
            
        # 2. Seed Faculty Registry
        faculty_users = [
            ("Bebin Faculty", "bebin@kahe.edu", "faculty123", "faculty", "fac_01"),
            ("Deepak Faculty", "deepak@kahe.edu", "faculty123", "faculty", "fac_02"),
            ("Jeya Faculty", "jeya@kahe.edu", "faculty123", "faculty", "fac_03"),
            ("CS HOD", "hod@kahe.edu", "hod123", "hod", "hod_01")
        ]
        
        for name, email, pwd, role, f_id in faculty_users:
            f_hashed = auth.get_password_hash(pwd)
            f_existing = db.query(models.User).filter(models.User.email == email).first()
            if not f_existing:
                db.add(models.User(name=name, email=email, password=f_hashed, role=role, faculty_id=f_id))
            else:
                f_existing.password = f_hashed
                f_existing.role = role
                f_existing.faculty_id = f_id
        
        # 3. Seed Departments
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)", "General", "Physics"]:
                db.add(models.Department(name=d))
        
        db.commit()
        logger.info("Institutional data synchronization successful.")
    except Exception as e:
        logger.error(f"Synchronization failure: {e}")
        db.rollback()
    finally:
        db.close()

# Start synchronization
seed_institutional_data()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- INSTITUTIONAL AUTHENTICATION ---

@app.post("/login", response_model=schemas.Token)
@api_router.post("/login", response_model=schemas.Token)
def institutional_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    identifier = form_data.username.strip()
    logger.info(f"Access attempt for identifier: {identifier}")
    
    # Resilient search: Case-insensitive email or exact faculty ID
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(identifier), 
            models.User.faculty_id == identifier
        )
    ).first()
    
    if not user:
        logger.warning(f"Access denied: Identity '{identifier}' not found in registry.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Institutional account not found. Please verify your email or ID."
        )
    
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Access denied: Password mismatch for identity '{identifier}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password for this institutional account."
        )
    
    logger.info(f"Access granted: {user.email} (Role: {user.role})")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- STATS & DATA ENDPOINTS ---

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
def get_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

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

# Standard institutional registry helper routes
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

app.include_router(api_router)

# Health & Synchronization Verification
@app.get("/api/health")
@app.get("/health")
def system_health():
    return {"status": "operational", "institutional_registry": "synchronized"}

# Serve Frontend Application
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def institutional_catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
