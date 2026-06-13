import logging
import os
import random
from fastapi import FastAPI, Depends, HTTPException, status
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
models.Base.metadata.create_all(bind=database.engine)

# Seeding Logic
def seed_data():
    db = database.SessionLocal()
    try:
        # Seed Users
        users_to_seed = [
            ("Admin User", "admin@kahe.edu", "admin123", "admin", "admin_01"),
            ("bebin", "bebin@kahe.edu", "faculty123", "faculty", "fac_01"),
            ("deepak", "deepak@kahe.edu", "faculty123", "faculty", "fac_02"),
            ("jeya", "jeya@kahe.edu", "faculty123", "faculty", "fac_03"),
            ("HOD User", "hod@kahe.edu", "hod123", "hod", "hod_01")
        ]
        for name, email, pwd, role, f_id in users_to_seed:
            hashed_pwd = auth.get_password_hash(pwd)
            existing = db.query(models.User).filter(models.User.email == email).first()
            if not existing:
                db.add(models.User(name=name, email=email, password=hashed_pwd, role=role, faculty_id=f_id))
            else:
                existing.password = hashed_pwd
                existing.role = role
                existing.faculty_id = f_id
        
        # Seed Departments
        if db.query(models.Department).count() == 0:
            for d in ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)", "General", "Physics"]:
                db.add(models.Department(name=d))
        
        # Seed Rooms
        if db.query(models.Room).count() == 0:
            rooms_data = [
                ("B-205", "Lab", 30, "Physics", "AVAILABLE", "Physics Lab", "2", "B Block"),
                ("S-01", "Seminar Hall", 200, "General", "AVAILABLE", "Seminar Hall 1", "G", "S Block"),
                ("C-302", "Office", 2, "Mathematics", "AVAILABLE", "Math Office", "3", "C Block"),
            ]
            for floor in ["2", "3", "4"]:
                for i in range(1, 21):
                    r_num = f"S-{floor}{str(i).zfill(2)}"
                    rooms_data.append((r_num, "Classroom", 60, "General", "AVAILABLE", f"Room {r_num}", floor, "S Block"))
            
            rooms_data.extend([
                ("s-500", "Classroom", 800, "Computer Science", "AVAILABLE", "Mega Class", "6", "S Block"),
                ("s-900", "Classroom", 650, "Computer Science", "AVAILABLE", "Grand Hall", "7", "S-Block")
            ])
            for r in rooms_data:
                dept_name = r[3]
                dept = db.query(models.Department).filter(models.Department.name == dept_name).first()
                db.add(models.Room(room_number=r[0], type=r[1], capacity=r[2], department_id=dept.id if dept else None, status=r[4], room_name=r[5], floor=r[6], building=r[7]))
        
        # Seed Academic Basics
        if db.query(models.WorkingDay).count() == 0:
            for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                db.add(models.WorkingDay(day_name=d, is_working=True))
        
        if db.query(models.PeriodTiming).count() == 0:
            periods = [(1, "09:00", "09:50"), (2, "09:50", "10:40"), (3, "11:00", "11:50"), (4, "11:50", "12:40"), (5, "01:30", "02:20"), (6, "02:20", "03:10")]
            for p in periods:
                db.add(models.PeriodTiming(period_number=p[0], start_time=p[1], end_time=p[2]))
        
        db.commit()
    except Exception as e:
        logger.error(f"Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

seed_data()

app = FastAPI(title="KAHE CMS")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- CORE API ROUTES ---

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(or_(models.User.email == form_data.username, models.User.faculty_id == form_data.username)).first()
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid institutional credentials")
    token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "user_id": user.id, "name": user.name}

@app.get("/dashboard-stats", response_model=schemas.DashboardStats)
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

@app.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)): return db.query(models.Room).all()

@app.post("/rooms", response_model=schemas.Room)
def create_room(room: schemas.RoomCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_room = models.Room(**room.model_dump())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@app.get("/timetables", response_model=List[schemas.Timetable])
def list_tt(semester_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    q = db.query(models.Timetable).options(joinedload(models.Timetable.subject), joinedload(models.Timetable.faculty), joinedload(models.Timetable.room), joinedload(models.Timetable.period))
    if semester_id: q = q.filter(models.Timetable.semester_id == semester_id)
    return q.all()

@app.post("/timetable-approval")
def approve_tt(semester_id: int, status: str, comments: Optional[str] = None, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.query(models.Timetable).filter(models.Timetable.semester_id == semester_id).update({"status": status, "approval_comments": comments})
    db.commit()
    return {"message": f"Updated to {status}"}

@app.get("/users_list", response_model=List[schemas.User])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)): return db.query(models.User).all()

@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_user = models.User(**user.model_dump(exclude={"password"}), password=auth.get_password_hash(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/class-history", response_model=List[schemas.ClassSession])
def get_history(db: Session = Depends(database.get_db)): return db.query(models.ClassSession).order_by(models.ClassSession.id.desc()).all()

@app.get("/active-sessions", response_model=List[schemas.ClassSession])
def get_active_sessions(db: Session = Depends(database.get_db)): return db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").all()

@app.get("/active-session/{room_id}", response_model=Optional[schemas.ClassSession])
def get_active_room_session(room_id: int, db: Session = Depends(database.get_db)): return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id, models.ClassSession.status == "ACTIVE").first()

@app.get("/working-days", response_model=List[schemas.WorkingDay])
def list_days(db: Session = Depends(database.get_db)): return db.query(models.WorkingDay).all()

@app.get("/period-timings", response_model=List[schemas.PeriodTiming])
def list_periods(db: Session = Depends(database.get_db)): return db.query(models.PeriodTiming).order_by(models.PeriodTiming.period_number).all()

@app.get("/departments", response_model=List[schemas.Department])
def list_depts(db: Session = Depends(database.get_db)): return db.query(models.Department).all()

@app.get("/programs", response_model=List[schemas.Program])
def list_progs(db: Session = Depends(database.get_db)): return db.query(models.Program).all()

@app.get("/semesters", response_model=List[schemas.Semester])
def list_sems(db: Session = Depends(database.get_db)): return db.query(models.Semester).all()

@app.get("/subjects", response_model=List[schemas.Subject])
def list_subs(db: Session = Depends(database.get_db)): return db.query(models.Subject).all()

@app.post("/subjects", response_model=schemas.Subject)
def create_sub(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(**sub.model_dump())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@app.post("/faculty-assignments")
def assign_f(assign: schemas.FacultyAssignmentBase, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)):
    db.add(models.FacultyAssignment(**assign.model_dump()))
    db.commit()
    return {"message": "Assigned"}

@app.post("/generate-timetable")
def gen_tt(semester_id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(auth.check_admin)): return {"message": "Success"}

@app.get("/notifications")
def get_notifs(db: Session = Depends(database.get_db), user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Notification).filter(models.Notification.user_id == user.id).all()

# --- STATIC FILES & CATCH-ALL ---

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    # Order matters: mount static files LAST
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    
    @app.exception_handler(404)
    async def catch_all(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
