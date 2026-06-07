from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from . import models, schemas, auth, database

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="KAHE Campus Management System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
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

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# Room APIs
@app.get("/rooms", response_model=List[schemas.Room])
def get_rooms(db: Session = Depends(database.get_db)):
    return db.query(models.Room).all()

@app.post("/rooms", response_model=schemas.Room)
def create_room(room: schemas.RoomCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_room = models.Room(**room.dict())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@app.put("/rooms/{room_id}", response_model=schemas.Room)
def update_room(room_id: int, room: schemas.RoomCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    for key, value in room.dict().items():
        setattr(db_room, key, value)
    db.commit()
    db.refresh(db_room)
    return db_room

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if db_room.status == "IN_USE":
        raise HTTPException(status_code=400, detail="Cannot delete a room while a class is in progress")

    db.delete(db_room)
    db.commit()
    return {"message": "Room deleted successfully"}

# Booking APIs
@app.post("/book-room", response_model=schemas.Booking)
def book_room(booking: schemas.BookingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_faculty)):
    # Check if the room is currently in use or has an existing booking
    room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
    
    # Check for overlapping bookings
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

@app.get("/bookings", response_model=List[schemas.Booking])
def get_bookings(db: Session = Depends(database.get_db)):
    return db.query(models.Booking).all()

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
    room = db.query(models.Room).filter(models.Room.id == session.room_id).first()
    if not room or room.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Room is not available")
    
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

@app.post("/end-class/{session_id}")
def end_class(session_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_session = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db_session.end_time = datetime.utcnow()
    db_session.status = "COMPLETED"
    
    room = db.query(models.Room).filter(models.Room.id == db_session.room_id).first()
    if room:
        room.status = "AVAILABLE"
        
        # Check for queued bookings and notify the next faculty
        next_booking = db.query(models.Booking).filter(
            models.Booking.room_id == room.id,
            models.Booking.status == "QUEUED"
        ).order_by(models.Booking.id.asc()).first()
        
        if next_booking:
            next_booking.status = "BOOKED"
            # Create a notification
            notification = models.Notification(
                user_id=next_booking.user_id,
                message=f"Classroom {room.room_number} is now available for your session."
            )
            db.add(notification)
    
    db.commit()
    return {"message": "Class ended successfully"}

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

# User Management (Admin Only)
@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    # Check if email is already taken
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")
    
    # Check if faculty_id/username is already taken
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

@app.get("/faculty", response_model=List[schemas.User])
def get_faculty(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    return db.query(models.User).filter(models.User.role == "faculty").all()

@app.get("/users_list", response_model=List[schemas.User])
def get_users_list(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    return db.query(models.User).all()

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_update: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.name = user_update.name
    db_user.email = user_update.email
    db_user.role = user_update.role
    db_user.faculty_id = user_update.faculty_id
    # Note: password update excluded for simplicity here, but can be added
    
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

# Department & Subject APIs
@app.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(database.get_db)):
    return db.query(models.Department).all()

@app.post("/departments", response_model=schemas.Department)
def create_department(dept: schemas.DepartmentBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_dept = models.Department(name=dept.name)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

@app.get("/subjects", response_model=List[schemas.Subject])
def get_subjects(db: Session = Depends(database.get_db)):
    return db.query(models.Subject).all()

@app.post("/subjects", response_model=schemas.Subject)
def create_subject(sub: schemas.SubjectBase, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.check_admin)):
    db_sub = models.Subject(name=sub.name, department_name=sub.department_name)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@app.get("/class-history", response_model=List[schemas.ClassSession])
def get_class_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.ClassSession)
    if current_user.role == "faculty":
        query = query.filter(models.ClassSession.faculty_user_id == current_user.id)
    return query.order_by(models.ClassSession.id.desc()).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
