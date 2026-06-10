import logging
import time
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from . import models, schemas, auth, database
except ImportError:
    import models, schemas, auth, database

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Retry logic for database connection during startup
max_retries = 5
for i in range(max_retries):
    try:
        models.Base.metadata.create_all(bind=database.engine)
        logger.info("Database tables created/verified.")
        break
    except Exception as e:
        if i < max_retries - 1:
            logger.warning(f"Database connection failed (attempt {i+1}/{max_retries}). Retrying in 5s...")
            time.sleep(5)
        else:
            logger.error("Could not connect to database after several attempts.")
            raise e

# Auto-seed admin user
def seed_admin():
    db = next(database.get_db())
    try:
        admin = db.query(models.User).filter(models.User.role == "admin").first()
        if not admin:
            hashed_password = auth.get_password_hash("admin123")
            admin_user = models.User(
                name="System Admin",
                email="admin@kahe.edu",
                password=hashed_password,
                role="admin",
                faculty_id="admin_01"
            )
            db.add(admin_user)
            db.commit()
            logger.info("Default admin user created.")
    except Exception as e:
        logger.error(f"Seeding error: {e}")
    finally:
        db.close()

seed_admin()

app = FastAPI(
    title="KAHE Campus Management System",
    description="Optimized backend for real-time classroom tracking and management."
)

# Optimized Middlewares
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed_password = auth.get_password_hash(user.password)
        role = user.role if user.role in ["faculty", "student"] else "student"
        db_user = models.User(
            name=user.name,
            email=user.email,
            password=hashed_password,
            role=role,
            faculty_id=user.faculty_id
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during registration.")

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    try:
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        if not user or not auth.verify_password(form_data.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "role": user.role,
            "user_id": user.id,
            "name": user.name
        }
    except SQLAlchemyError as e:
        logger.error(f"Database error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during login.")

# Room APIs
@app.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)):
    try:
        return db.query(models.Room).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching rooms: {str(e)}")
        return []

@app.post("/rooms", response_model=schemas.Room)
def create_room(room: schemas.RoomCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_room = models.Room(**room.dict())
        db.add(db_room)
        db.commit()
        db.refresh(db_room)
        return db_room
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating room: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to create room. Please ensure the room number is unique.")

@app.put("/rooms/{room_id}", response_model=schemas.Room)
def update_room(room_id: int, room: schemas.RoomCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room not found")
        for key, value in room.dict().items():
            setattr(db_room, key, value)
        db.commit()
        db.refresh(db_room)
        return db_room
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating room {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update classroom information.")

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
        if not db_room:
            raise HTTPException(status_code=404, detail="Room not found")
        
        if db_room.status == "IN_USE":
            raise HTTPException(status_code=400, detail="Cannot delete a room while a class is in progress.")

        db.delete(db_room)
        db.commit()
        return {"message": "Room deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting room {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete classroom.")

# Booking APIs
@app.post("/book-room", response_model=schemas.Booking)
def book_room(booking: schemas.BookingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_faculty)):
    try:
        room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Target classroom not found.")
        
        overlap = db.query(models.Booking).filter(
            models.Booking.room_id == booking.room_id,
            models.Booking.start_time < booking.end_time,
            models.Booking.end_time > booking.start_time,
            models.Booking.status != "CANCELLED"
        ).first()

        status = "BOOKED"
        if room.status == "IN_USE" or overlap:
            status = "QUEUED"
        
        db_booking = models.Booking(**booking.dict(), user_id=current_user.id, status=status)
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        return db_booking
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error during booking: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process booking reservation.")

@app.get("/bookings", response_model=List[schemas.Booking])
def get_bookings(db: Session = Depends(database.get_db)):
    return db.query(models.Booking).options(joinedload(models.Booking.room)).all()

@app.delete("/bookings/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    db.delete(db_booking)
    db.commit()
    return {"message": "Booking deleted successfully"}

@app.put("/bookings/{booking_id}", response_model=schemas.Booking)
def update_booking(booking_id: int, booking: schemas.BookingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    for key, value in booking.dict().items():
        setattr(db_booking, key, value)
    db.commit()
    db.refresh(db_booking)
    return db_booking

# Class Session APIs
@app.post("/start-class", response_model=schemas.ClassSession)
def start_class(session: schemas.ClassSessionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        room = db.query(models.Room).filter(models.Room.id == session.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        if room.status != "AVAILABLE":
            raise HTTPException(status_code=400, detail="Room is currently occupied or unavailable.")
        
        db_session = models.ClassSession(
            **session.dict(),
            faculty_user_id=current_user.id,
            status="ACTIVE",
            start_time=datetime.utcnow()
        )
        db.add(db_session)
        room.status = "IN_USE"
        db.commit()
        db.refresh(db_session)
        return db_session
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error starting class: {str(e)}")
        raise HTTPException(status_code=500, detail="Database failure while starting class session.")

@app.post("/end-class/{session_id}")
def end_class(session_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        db_session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
        if not db_session:
            raise HTTPException(status_code=404, detail="Class session record not found.")
        
        db_session.end_time = datetime.utcnow()
        db_session.status = "COMPLETED"
        
        room = db.query(models.Room).filter(models.Room.id == db_session.room_id).first()
        if room:
            room.status = "AVAILABLE"
            next_booking = db.query(models.Booking).filter(
                models.Booking.room_id == room.id,
                models.Booking.status == "QUEUED"
            ).order_by(models.Booking.id.asc()).first()
            
            if next_booking:
                next_booking.status = "BOOKED"
                notification = models.Notification(
                    user_id=next_booking.user_id,
                    message=f"Classroom {room.room_number} is now available for your session."
                )
                db.add(notification)
        
        db.commit()
        return {"message": "Class session ended successfully and room released."}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error ending class {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end class session properly.")

# Notification APIs
@app.get("/notifications")
def get_notifications(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.id.desc()).all()

@app.post("/notifications/read/{notif_id}")
def mark_notification_read(notif_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    notif = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}

@app.get("/active-session/{room_id}", response_model=Optional[schemas.ClassSession])
def get_active_session(room_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(
        models.ClassSession.room_id == room_id,
        models.ClassSession.status == "ACTIVE"
    ).first()

@app.get("/active-sessions", response_model=List[schemas.ClassSession])
def get_all_active_sessions(db: Session = Depends(database.get_db)):
    return db.query(models.ClassSession).filter(models.ClassSession.status == "ACTIVE").all()

# User Management (Admin Only)
@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        existing_user = db.query(models.User).filter(models.User.email == user.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="A user with this email address already exists.")
        existing_id = db.query(models.User).filter(models.User.faculty_id == user.faculty_id).first()
        if existing_id:
            raise HTTPException(status_code=400, detail="This User ID (Username) is already taken.")

        hashed_password = auth.get_password_hash(user.password)
        db_user = models.User(
            name=user.name,
            email=user.email,
            password=hashed_password,
            role=user.role,
            faculty_id=user.faculty_id
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail="Database failure while creating user account.")

@app.get("/users_list", response_model=List[schemas.User])
def get_users_list(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        return db.query(models.User).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching users: {str(e)}")
        return []

@app.get("/faculty", response_model=List[schemas.User])
def get_faculty(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        return db.query(models.User).filter(models.User.role == "faculty").all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching faculty: {str(e)}")
        return []

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User account not found.")
        
        if user_update.name is not None: db_user.name = user_update.name
        if user_update.email is not None: db_user.email = user_update.email
        if user_update.role is not None: db_user.role = user_update.role
        if user_update.faculty_id is not None: db_user.faculty_id = user_update.faculty_id
        
        if user_update.password:
            db_user.password = auth.get_password_hash(user_update.password)
        
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user information.")

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User account not found.")
        db.delete(db_user)
        db.commit()
        return {"message": "User account deleted successfully."}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database failure while deleting account.")

# Department & Subject APIs
@app.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(database.get_db)):
    try:
        return db.query(models.Department).all()
    except:
        return []

@app.post("/departments", response_model=schemas.Department)
def create_department(dept: schemas.DepartmentBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_dept = models.Department(name=dept.name)
        db.add(db_dept)
        db.commit()
        db.refresh(db_dept)
        return db_dept
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating department: {str(e)}")
        raise HTTPException(status_code=400, detail="Department already exists or invalid data.")

@app.get("/subjects", response_model=List[schemas.Subject])
def get_subjects(db: Session = Depends(database.get_db)):
    try:
        return db.query(models.Subject).all()
    except:
        return []

@app.post("/subjects", response_model=schemas.Subject)
def create_subject(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    try:
        db_sub = models.Subject(name=sub.name, department_name=sub.department_name)
        db.add(db_sub)
        db.commit()
        db.refresh(db_sub)
        return db_sub
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating subject: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to create subject record.")

@app.get("/class-history", response_model=List[schemas.ClassSession])
def get_class_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        query = db.query(models.ClassSession).options(joinedload(models.ClassSession.room))
        if current_user.role == "faculty":
            query = query.filter(models.ClassSession.faculty_user_id == current_user.id)
        return query.order_by(models.ClassSession.id.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching history: {str(e)}")
        return []

@app.get("/room-history/{room_id}", response_model=List[schemas.ClassSession])
def get_room_history(room_id: int, db: Session = Depends(database.get_db)):
    try:
        return db.query(models.ClassSession).filter(models.ClassSession.room_id == room_id).order_by(models.ClassSession.id.desc()).all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching room history: {str(e)}")
        return []

# Schedule APIs
@app.get("/schedules", response_model=List[schemas.Schedule])
def get_schedules(db: Session = Depends(database.get_db)):
    return db.query(models.Schedule).options(joinedload(models.Schedule.room), joinedload(models.Schedule.faculty)).all()

@app.post("/schedules", response_model=schemas.Schedule)
def create_schedule(schedule: schemas.ScheduleCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_schedule = models.Schedule(**schedule.dict())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(db_schedule)
    db.commit()
    return {"message": "Schedule deleted"}

# Serve Frontend Static Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")

if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
    
    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
