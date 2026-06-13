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

# Force logging to be visible in all environments
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("KAHE-CMS")

# Ensure tables exist
models.Base.metadata.create_all(bind=database.engine)

def force_sync_admin():
    """Definitively resets the admin account to ensure login works immediately."""
    db = database.SessionLocal()
    try:
        logger.info("CRITICAL: Force-syncing Administrator Registry...")
        
        # 1. Clean existing collisions
        db.query(models.User).filter(
            or_(models.User.email == "admin@kahe.edu", models.User.faculty_id == "admin_01")
        ).delete(synchronize_session=False)
        db.commit()

        # 2. Register Definitive Admin
        # Password 'admin123'
        hashed_p = auth.get_password_hash("admin123")
        admin = models.User(
            name="System Administrator",
            email="admin@kahe.edu",
            password=hashed_p,
            role="admin",
            faculty_id="admin_01"
        )
        db.add(admin)
        
        # 3. Register Faculty (Bebin)
        # Password 'faculty123'
        hashed_f = auth.get_password_hash("faculty123")
        bebin = models.User(
            name="Bebin Faculty",
            email="bebin@kahe.edu",
            password=hashed_f,
            role="faculty",
            faculty_id="fac_01"
        )
        db.add(bebin)
        
        db.commit()
        logger.info("CRITICAL: Institutional Registry Synchronization SUCCESSFUL.")
    except Exception as e:
        logger.error(f"Registry Sync Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Synchronize registry on boot
force_sync_admin()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

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
    identifier = form_data.username.strip()
    logger.info(f"LOGIN ATTEMPT: identifier='{identifier}'")
    
    # Resilient case-insensitive search
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(identifier), 
            models.User.faculty_id == identifier
        )
    ).first()
    
    if not user:
        logger.warning(f"LOGIN DENIED: Identity '{identifier}' not found in registry.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please verify your Email or ID."
        )
    
    # Password Validation
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"LOGIN DENIED: Password mismatch for identity '{user.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Access denied."
        )
    
    logger.info(f"LOGIN GRANTED: identity='{user.email}' role='{user.role}'")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- MODULE DIRECTORY ---

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

# Helper endpoints
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

# System Health
@app.get("/api/health")
@app.get("/health")
def system_health():
    return {"status": "synchronized", "ts": datetime.now(timezone.utc)}

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
