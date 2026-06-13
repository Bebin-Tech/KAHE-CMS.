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
logger = logging.getLogger("KAHE-CMS")

# 1. Initialize Registry on Startup
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("Institutional database schema verified.")
except Exception as e:
    logger.critical(f"Schema verification failed: {e}")

def sync_institutional_registry():
    """Forces synchronization of core accounts with exact credentials."""
    db = database.SessionLocal()
    try:
        logger.info("Synchronizing institutional registry...")
        registry = [
            {"email": "admin@kahe.edu", "id": "admin_01", "pwd": "admin123", "role": "admin", "name": "System Administrator"},
            {"email": "bebin@kahe.edu", "id": "fac_01", "pwd": "faculty123", "role": "faculty", "name": "Bebin Faculty"}
        ]
        
        for entry in registry:
            hashed_p = auth.get_password_hash(entry["pwd"])
            # Remove any identity collisions first to ensure clean state
            db.query(models.User).filter(
                or_(models.User.email == entry["email"], models.User.faculty_id == entry["id"])
            ).delete(synchronize_session=False)
            
            # Re-register fresh definitively
            db.add(models.User(
                name=entry["name"],
                email=entry["email"],
                password=hashed_p,
                role=entry["role"],
                faculty_id=entry["id"]
            ))
            logger.info(f"Registry: Identity '{entry['email']}' successfully synchronized.")
            
        db.commit()
        logger.info("Institutional registry synchronization successful.")
    except Exception as e:
        logger.error(f"Registry Synchronization Error: {e}")
        db.rollback()
    finally:
        db.close()

sync_institutional_registry()

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

# --- AUTHENTICATION MODULE ---

@api_router.post("/login", response_model=schemas.Token)
@app.post("/login", response_model=schemas.Token) # Allow root and api prefix
async def institutional_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Resilient login gateway for institutional portal."""
    identifier = form_data.username.strip()
    logger.info(f"Portal Access Request: identifier='{identifier}'")
    
    # 1. Resolve Identity
    user = db.query(models.User).filter(
        or_(models.User.email.ilike(identifier), models.User.faculty_id == identifier)
    ).first()
    
    if not user:
        logger.warning(f"Access Denied: identity '{identifier}' not found in registry.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please verify your institutional Email/ID."
        )
    
    # 2. Verify Credentials
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Access Denied: credential mismatch for '{user.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Access denied for this institutional account."
        )
    
    # 3. Grant Access
    logger.info(f"Access Granted: identity='{user.email}' role='{user.role}'")
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name
    }

# --- STATS & DIRECTORY ---

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

# Helper endpoints for portal UI
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

# Health verification
@app.get("/api/health")
@app.get("/health")
def system_health():
    return {"status": "operational", "registry": "synchronized", "v": "7.1"}

# Frontend Integration
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
