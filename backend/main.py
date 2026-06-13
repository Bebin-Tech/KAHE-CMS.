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

# 1. Initialize Database
try:
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("Institutional database schema verified.")
except Exception as e:
    logger.critical(f"Database initialization failure: {e}")

# 2. Definitive Security Registry Sync
def sync_institutional_registry():
    """Forces synchronization of core administrator and faculty accounts on system boot."""
    db = database.SessionLocal()
    try:
        logger.info("Registry: Initiating institutional security synchronization...")
        
        # Primary identities
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
        
        for account in core_accounts:
            # Identity Hash Generation
            hashed_pwd = auth.get_password_hash(account["pwd"])
            
            # Resolve collisions (by email or institutional id)
            db.query(models.User).filter(
                or_(
                    models.User.email == account["email"],
                    models.User.faculty_id == account["id"]
                )
            ).delete(synchronize_session=False)
            
            # Re-register definitive identity
            db.add(models.User(
                name=account["name"],
                email=account["email"],
                password=hashed_pwd,
                role=account["role"],
                faculty_id=account["id"]
            ))
            logger.info(f"Registry: Identity '{account['email']}' synchronized.")
        
        # Base Departments
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS"]:
                db.add(models.Department(name=d))
            
        db.commit()
        logger.info("Registry: Institutional security synchronization SUCCESSFUL.")
    except Exception as e:
        logger.error(f"Registry Sync Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Execute sync on boot
sync_institutional_registry()

app = FastAPI(title="KAHE CMS")

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

@app.post("/api/login", response_model=schemas.Token)
@app.post("/login", response_model=schemas.Token)
async def login_gateway(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Resilient entry point for all institutional identity verification requests."""
    identifier = form_data.username.strip()
    logger.info(f"Access Request: Verifying credentials for identity '{identifier}'")
    
    # 1. Resolve Identity
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
    
    # 2. Verify Credentials
    if not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Access Denied: Credential mismatch for identity '{user.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials. Please verify your password."
        )
    
    # 3. Create Session
    logger.info(f"Access Granted: Institutional identity '{user.email}' verified. Issuing session.")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- MODULE ENDPOINTS ---

api_router = APIRouter(prefix="/api")

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
        "generated_timetables": 0, "pending_approvals": 0, "approved_timetables": 0, "published_timetables": 0, "conflict_alerts": 0
    }

@api_router.get("/rooms", response_model=List[schemas.Room])
def list_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

# registry helper routes
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
def health():
    return {"status": "synchronized", "v": "1.2", "ts": datetime.now(timezone.utc)}

# Frontend SPA Hosting
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
