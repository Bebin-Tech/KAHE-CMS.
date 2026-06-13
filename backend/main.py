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

# Configure production-grade logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("KAHE-CMS-BACKEND")

# 1. Initialize Database Schema
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("Institutional database schema verified.")
except Exception as e:
    logger.critical(f"Database schema initialization failure: {e}")

# 2. Definitive Registry Synchronization
def force_sync_institutional_registry():
    """Forces synchronization of primary administrative and faculty identities."""
    db = database.SessionLocal()
    try:
        logger.info("Initializing Security Registry Synchronization...")
        
        # Identity targets
        core_accounts = [
            {
                "email": "admin@kahe.edu",
                "pwd": "admin123",
                "role": "admin",
                "id": "admin_01",
                "name": "System Administrator"
            },
            {
                "email": "bebin@kahe.edu",
                "pwd": "faculty123",
                "role": "faculty",
                "id": "fac_01",
                "name": "Bebin Faculty"
            }
        ]
        
        for acc in core_accounts:
            # Clean up existing identities to ensure fresh credentials work
            db.query(models.User).filter(
                or_(
                    models.User.email == acc["email"],
                    models.User.faculty_id == acc["id"]
                )
            ).delete(synchronize_session=False)
            
            # Create fresh identity with current hashing engine
            hashed_pwd = auth.get_password_hash(acc["pwd"])
            new_user = models.User(
                name=acc["name"],
                email=acc["email"],
                password=hashed_pwd,
                role=acc["role"],
                faculty_id=acc["id"]
            )
            db.add(new_user)
            logger.info(f"Registry: Registered/Synchronized identity {acc['email']}")
        
        # Ensure institutional departments exist
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS"]:
                db.add(models.Department(name=d))
            logger.info("Registry: Default departments initialized.")
            
        db.commit()
        logger.info("Institutional Security Registry Synchronization SUCCESSFUL.")
    except Exception as e:
        logger.error(f"Security Registry Synchronization Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Execute sync on startup
force_sync_institutional_registry()

app = FastAPI(title="KAHE Campus Management System")
api_router = APIRouter(prefix="/api")

# CORS and Performance
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
@app.post("/login", response_model=schemas.Token) # Support both prefixed and direct access
async def institutional_login_gateway(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Primary entry point for institutional identity verification."""
    identifier = form_data.username.strip()
    logger.info(f"Access Request: Verifying identity for '{identifier}'")
    
    # Resolve Identity (Case-Insensitive for Email)
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(identifier), 
            models.User.faculty_id == identifier
        )
    ).first()
    
    if not user:
        logger.warning(f"Access Denied: Identity '{identifier}' not found in registry.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Verify your institutional Email or ID."
        )
    
    # Credential Validation (Resilient hashing engine)
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Access Denied: Credential mismatch for identity '{user.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials. Please verify your password."
        )
    
    logger.info(f"Access Granted: Institutional identity '{user.email}' verified. Session issued.")
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- SYSTEM STATS & METRICS ---

@api_router.get("/dashboard-stats", response_model=schemas.DashboardStats)
def get_institutional_stats(db: Session = Depends(database.get_db)):
    return {
        "total_departments": db.query(models.Department).count(),
        "total_programs": db.query(models.Program).count(),
        "total_semesters": db.query(models.Semester).count(),
        "total_subjects": db.query(models.Subject).count(),
        "total_faculties": db.query(models.User).filter(models.User.role == "faculty").count(),
        "total_classrooms": db.query(models.Room).filter(models.Room.type == "Classroom").count(),
        "total_labs": db.query(models.Room).filter(models.Room.type == "Lab").count(),
        "generated_timetables": 0,
        "pending_approvals": 0,
        "approved_timetables": 0,
        "published_timetables": 0,
        "conflict_alerts": 0
    }

# --- DIRECTORY SERVICES ---

@api_router.get("/rooms", response_model=List[schemas.Room])
def list_room_directory(db: Session = Depends(database.get_db)): 
    return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_user_registry(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def list_operational_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

# Helper endpoints for registry and academic settings
@api_router.get("/working-days", response_model=List[schemas.WorkingDay])
def list_working_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@api_router.get("/period-timings", response_model=List[schemas.PeriodTiming])
def list_period_timings(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@api_router.get("/departments", response_model=List[schemas.Department])
def list_departments(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@api_router.get("/programs", response_model=List[schemas.Program])
def list_programs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@api_router.get("/semesters", response_model=List[schemas.Semester])
def list_semesters(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@api_router.get("/subjects", response_model=List[schemas.Subject])
def list_subjects(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

app.include_router(api_router)

# System Health
@app.get("/api/health")
@app.get("/health")
def system_heartbeat():
    return {"status": "synchronized", "version": "v1.1", "timestamp": datetime.now(timezone.utc)}

# Frontend SPA Hosting
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def institutional_catch_all(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
