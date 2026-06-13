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
    logger.info("Institutional database registry initialized.")
except Exception as e:
    logger.error(f"Database initialization critical failure: {e}")

# Robust Institutional Seeding
def synchronize_institutional_registry():
    db = database.SessionLocal()
    try:
        logger.info("Synchronizing institutional security protocols...")
        
        # 1. Definitive Accounts Synchronization
        institutional_accounts = [
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
            },
            {
                "email": "hod@kahe.edu",
                "pwd": "hod123",
                "role": "hod",
                "id": "hod_01",
                "name": "Institutional HOD"
            }
        ]
        
        for account in institutional_accounts:
            hashed_pwd = auth.get_password_hash(account["pwd"])
            
            # Use a fresh query for each account to avoid session state issues
            existing_user = db.query(models.User).filter(
                or_(
                    models.User.email == account["email"],
                    models.User.faculty_id == account["id"]
                )
            ).first()
            
            if existing_user:
                # Update existing user to match definitive registry
                existing_user.email = account["email"]
                existing_user.faculty_id = account["id"]
                existing_user.password = hashed_pwd
                existing_user.role = account["role"]
                existing_user.name = account["name"]
                logger.info(f"Registry Sync: Updated account {account['email']}")
            else:
                # Create fresh definitive account
                new_user = models.User(
                    name=account["name"],
                    email=account["email"],
                    password=hashed_pwd,
                    role=account["role"],
                    faculty_id=account["id"]
                )
                db.add(new_user)
                logger.info(f"Registry Sync: Created fresh account {account['email']}")
        
        # 2. Seed Departments
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)", "General", "Physics"]:
                db.add(models.Department(name=d))
        
        db.commit()
        logger.info("Institutional registry synchronization successful.")
    except Exception as e:
        logger.error(f"Registry Synchronization Failure: {e}")
        db.rollback()
    finally:
        db.close()

# Execute synchronization on boot
synchronize_institutional_registry()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- INSTITUTIONAL AUTHENTICATION GATEWAY ---

@api_router.post("/login", response_model=schemas.Token)
@app.post("/login", response_model=schemas.Token)
def gateway_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # Standardize identifier (trim and standard lowercase for logic, but search is ilike)
    identifier = form_data.username.strip()
    logger.info(f"Access Request: Verifying credentials for identity '{identifier}'")
    
    # Resilient search: Case-insensitive email or exact faculty ID
    user = db.query(models.User).filter(
        or_(
            models.User.email.ilike(identifier), 
            models.User.faculty_id == identifier
        )
    ).first()
    
    if not user:
        logger.warning(f"Access Rejected: Identity '{identifier}' not found in registry.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identity not registered in the institutional portal."
        )
    
    # Direct verify with detailed failure logging
    try:
        is_valid = auth.verify_password(form_data.password, user.password)
    except Exception as e:
        logger.error(f"Security Engine Error: {e}")
        raise HTTPException(status_code=500, detail="Security validation engine failed.")

    if not is_valid:
        logger.warning(f"Access Rejected: Credential mismatch for identity '{identifier}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials. Please verify your password."
        )
    
    logger.info(f"Access Granted: Institutional identity {user.email} verified (Role: {user.role})")
    
    # Create Access Token
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": user.role, 
        "user_id": user.id, 
        "name": user.name
    }

# --- STATS & ANALYTICS ---

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

# --- MODULE DIRECTORY ---

@api_router.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@api_router.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@api_router.get("/class-history", response_model=List[schemas.ClassSession])
def get_history(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

# Registry helper routes
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

# System Health & Registry Status
@app.get("/api/health")
@app.get("/health")
def system_heartbeat():
    return {"status": "operational", "institutional_registry": "synchronized"}

# Frontend Integration Layer
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def institutional_catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
