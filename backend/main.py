import logging
import os
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timezone
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from . import models, schemas, auth, database
except ImportError:
    import models, schemas, auth, database

# Configure logging for production-grade monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Verify Database Connection and Initialize Registry
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("KAHE CMS: Institutional database schema verified and operational.")
except Exception as e:
    logger.critical(f"KAHE CMS: Database initialization failure: {e}")

# Definitive Institutional Registry Synchronization (v7.0 Stable)
def sync_registry():
    """Forces synchronization of core institutional accounts on system boot."""
    db = database.SessionLocal()
    try:
        logger.info("KAHE CMS: Initiating security registry synchronization...")
        
        # Core accounts registry
        core_registry = [
            {"email": "admin@kahe.edu", "pwd": "admin123", "role": "admin", "id": "admin_01", "name": "System Administrator"},
            {"email": "bebin@kahe.edu", "pwd": "faculty123", "role": "faculty", "id": "fac_01", "name": "Bebin Faculty"},
            {"email": "hod@kahe.edu", "pwd": "hod123", "role": "hod", "id": "hod_01", "name": "Department HOD"}
        ]
        
        for entry in core_registry:
            hashed_pwd = auth.get_password_hash(entry["pwd"])
            
            # Identify existing accounts by primary identifiers
            existing = db.query(models.User).filter(
                or_(models.User.email == entry["email"], models.User.faculty_id == entry["id"])
            ).first()
            
            if existing:
                # Synchronize credentials and permissions
                existing.email = entry["email"]
                existing.faculty_id = entry["id"]
                existing.password = hashed_pwd
                existing.role = entry["role"]
                existing.name = entry["name"]
                logger.info(f"Registry: Synchronized identity {entry['email']}")
            else:
                # Register fresh institutional identity
                db.add(models.User(
                    name=entry["name"],
                    email=entry["email"],
                    password=hashed_pwd,
                    role=entry["role"],
                    faculty_id=entry["id"]
                ))
                logger.info(f"Registry: Registered identity {entry['email']}")
        
        # Ensure base departments exist
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS", "Physics"]:
                db.add(models.Department(name=d))
        
        db.commit()
        logger.info("KAHE CMS: Registry synchronization complete. Login system ready.")
    except Exception as e:
        logger.error(f"KAHE CMS: Registry Sync Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Synchronize on application startup
sync_registry()

app = FastAPI(title="KAHE Campus Management System")
api_router = APIRouter(prefix="/api")

# CORS Configuration
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTHENTICATION GATEWAY ---

@api_router.post("/login", response_model=schemas.Token)
@app.post("/login", response_model=schemas.Token)
async def login_gateway(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Institutional Login Gateway supporting Email and ID identification."""
    identifier = form_data.username.strip()
    logger.info(f"Login Attempt: Verifying credentials for '{identifier}'")
    
    # Case-insensitive search for identity
    user = db.query(models.User).filter(
        or_(models.User.email.ilike(identifier), models.User.faculty_id == identifier)
    ).first()
    
    if not user:
        logger.warning(f"Login Failure: Identity '{identifier}' not found.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Institutional identity not found. Verify your Email or ID."
        )
    
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Login Failure: Password mismatch for '{user.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Access denied."
        )
    
    logger.info(f"Login Success: {user.email} verified.")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name
    }

# --- SYSTEM STATS & METRICS ---

@api_router.get("/dashboard-stats", response_model=schemas.DashboardStats)
def get_dashboard_metrics(db: Session = Depends(database.get_db)):
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

# --- DIRECTORY ACCESS ---

@api_router.get("/rooms", response_model=List[schemas.Room])
def get_room_directory(db: Session = Depends(database.get_db)):
    return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def get_user_registry(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_operational_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

# Helper endpoints for academic data
@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def get_working_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def get_periods(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@api_router.get("/departments", response_model=List[schemas.Department])
def get_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.get("/programs", response_model=List[schemas.Program])
def get_programs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.get("/semesters", response_model=List[schemas.Semester])
def get_semesters(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@api_router.get("/subjects", response_model=List[schemas.Subject])
def get_subjects(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

app.include_router(api_router)

# Health & Status Monitor
@app.get("/api/health")
@app.get("/health")
def system_heartbeat():
    return {"status": "synchronized", "version": "v7.0", "timestamp": datetime.now(timezone.utc)}

# Frontend SPA Hosting
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def spa_handler(request, exc): 
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
