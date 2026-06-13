import logging
import os
import sys
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

# Production-grade logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("KAHE-CMS-BACKEND")

# 1. Database Initialization
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("Database schema verified.")
except Exception as e:
    logger.critical(f"Database schema verification failed: {e}")

# 2. Institutional Registry Sync (CRITICAL FIX)
def sync_institutional_data():
    """Ensures the admin and faculty registry is perfectly synchronized on every boot."""
    db = database.SessionLocal()
    try:
        logger.info("Initializing institutional security synchronization...")
        
        # DEFINITIVE ACCOUNT LIST
        # These are the only accounts guaranteed to work after sync
        registry = [
            {
                "email": "admin@kahe.edu",
                "id": "admin_01",
                "pwd": "admin123",
                "role": "admin",
                "name": "System Administrator"
            },
            {
                "email": "bebin@kahe.edu",
                "id": "fac_01",
                "pwd": "faculty123",
                "role": "faculty",
                "name": "Bebin Faculty"
            }
        ]
        
        for account in registry:
            hashed_pwd = auth.get_password_hash(account["pwd"])
            
            # Find any record that matches either the email or the institutional ID
            existing = db.query(models.User).filter(
                or_(models.User.email == account["email"], models.User.faculty_id == account["id"])
            ).first()
            
            if existing:
                # Force update all fields to match the code-defined registry
                existing.email = account["email"]
                existing.faculty_id = account["id"]
                existing.password = hashed_pwd
                existing.role = account["role"]
                existing.name = account["name"]
                logger.info(f"Registry: Synchronized existing identity '{account['email']}'")
            else:
                # Create the missing institutional identity
                new_user = models.User(
                    name=account["name"],
                    email=account["email"],
                    password=hashed_pwd,
                    role=account["role"],
                    faculty_id=account["id"]
                )
                db.add(new_user)
                logger.info(f"Registry: Registered fresh identity '{account['email']}'")
        
        # Ensure base departments exist for the system
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS", "Physics"]:
                db.add(models.Department(name=d))
        
        db.commit()
        logger.info("Institutional registry synchronization successful.")
    except Exception as e:
        logger.error(f"Registry Sync Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Start sync
sync_institutional_data()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

# CORS Policy: Allowing all for development/production transition
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTHENTICATION MODULE ---

@api_router.post("/login", response_model=schemas.Token)
@app.post("/login", response_model=schemas.Token)
async def login_entry_point(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Single, resilient entry point for all institutional login requests."""
    identifier = form_data.username.strip()
    logger.info(f"Login Attempt: {identifier}")
    
    # 1. Resolve User Identity
    # Check by institutional email (case-insensitive) OR institutional ID
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(identifier), 
            models.User.faculty_id == identifier
        )
    ).first()
    
    if not user:
        logger.warning(f"Login Denied: Identity '{identifier}' not found.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Institutional identity '{identifier}' not recognized."
        )
    
    # 2. Verify Credentials
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Login Denied: Password mismatch for identity '{user.email}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password for this institutional account."
        )
    
    # 3. Create Session
    logger.info(f"Login Success: {user.email} (Role: {user.role})")
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name
    }

# --- SYSTEM METRICS ---

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

# --- MODULE DIRECTORIES ---

@api_router.get("/rooms", response_model=List[schemas.Room])
def list_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def list_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

# Academic Helper Routes
@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def get_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def get_periods(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@api_router.get("/departments", response_model=List[schemas.Department])
def get_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.get("/programs", response_model=List[schemas.Program])
def get_progs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.get("/semesters", response_model=List[schemas.Semester])
def get_sems(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@api_router.get("/subjects", response_model=List[schemas.Subject])
def get_subs(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

app.include_router(api_router)

# --- SYSTEM HEALTH ---
@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "operational", "registry": "synced", "ts": datetime.now(timezone.utc)}

# --- FRONTEND HOSTING ---
# IMPORTANT: API routes are defined first, then frontend serves as a catch-all
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
