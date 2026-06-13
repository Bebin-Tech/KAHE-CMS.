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

# Global Institutional Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("KAHE-CMS")

# Database Synchronization
models.Base.metadata.create_all(bind=database.engine)

def sync_registry():
    """Forces synchronization of core administrator and faculty accounts."""
    db = database.SessionLocal()
    try:
        logger.info("Registry: Synchronizing institutional security layer...")
        accounts = [
            {"email": "admin@kahe.edu", "id": "admin_01", "pwd": "admin123", "role": "admin", "name": "System Administrator"},
            {"email": "bebin@kahe.edu", "id": "fac_01", "pwd": "faculty123", "role": "faculty", "name": "Bebin Faculty"}
        ]
        for acc in accounts:
            hashed = auth.get_password_hash(acc["pwd"])
            user = db.query(models.User).filter(or_(models.User.email == acc["email"], models.User.faculty_id == acc["id"])).first()
            if user:
                user.email = acc["email"]
                user.faculty_id = acc["id"]
                user.password = hashed
                user.role = acc["role"]
                user.name = acc["name"]
            else:
                db.add(models.User(name=acc["name"], email=acc["email"], password=hashed, role=acc["role"], faculty_id=acc["id"]))
        db.commit()
        logger.info("Registry: Synchronization complete.")
    except Exception as e:
        logger.error(f"Registry Failure: {e}")
        db.rollback()
    finally:
        db.close()

sync_registry()

app = FastAPI(title="KAHE CMS")
api_router = APIRouter(prefix="/api")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- CORE AUTHENTICATION ---

@app.post("/login", response_model=schemas.Token)
def login_root(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Primary institutional login gateway."""
    identifier = form_data.username.strip()
    logger.info(f"Access Request: {identifier}")
    
    user = db.query(models.User).filter(
        or_(models.User.email.ilike(identifier), models.User.faculty_id == identifier)
    ).first()
    
    if not user or not auth.verify_password(form_data.password, user.password):
        logger.warning(f"Access Denied: {identifier}")
        raise HTTPException(status_code=401, detail="Invalid institutional credentials.")
    
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "user_id": user.id, "name": user.name}

@api_router.post("/login", response_model=schemas.Token)
def login_api(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Redundant API login endpoint for environment compatibility."""
    return login_root(form_data, db)

# --- SYSTEM MODULES ---

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
def health(): return {"status": "synchronized", "ts": datetime.now(timezone.utc)}

# Frontend Hosting
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def catch_all(request, exc): return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
