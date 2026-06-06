from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import enum
from datetime import datetime

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"

class RoomType(str, enum.Enum):
    CLASSROOM = "Classroom"
    LAB = "Lab"
    OFFICE = "Office"
    SEMINAR_HALL = "Seminar Hall"

class RoomStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BOOKED = "BOOKED"
    IN_USE = "IN_USE"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String, unique=True, index=True, nullable=True) # For Faculty
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) # admin, faculty, student

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True)
    type = Column(String)
    capacity = Column(Integer)
    department = Column(String)
    status = Column(String, default="AVAILABLE") # AVAILABLE, IN_USE

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    faculty_user_id = Column(Integer, ForeignKey("users.id"))
    faculty_id_display = Column(String) # For display/input
    faculty_name = Column(String)
    department = Column(String)
    subject = Column(String)
    section = Column(String)
    date = Column(String)
    start_time_display = Column(String) # For form input
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    remarks = Column(String)
    status = Column(String, default="ACTIVE") # ACTIVE, COMPLETED

    room = relationship("Room")
    faculty = relationship("User")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    faculty_name = Column(String) # Added
    department = Column(String) # Added
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="BOOKED") # BOOKED, QUEUED, COMPLETED

    user = relationship("User")
    room = relationship("Room")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    department_name = Column(String)

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    subject = Column(String)
    time_slot = Column(String)
    day_of_week = Column(String)

    faculty = relationship("User")
    room = relationship("Room")
