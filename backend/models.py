from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Time, Table
from sqlalchemy.orm import relationship
try:
    from .database import Base
except ImportError:
    from database import Base
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

class TimetableStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) # admin, faculty, student

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    programs = relationship("Program", back_populates="department")

class Program(Base):
    __tablename__ = "programs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    department = relationship("Department", back_populates="programs")
    semesters = relationship("Semester", back_populates="program")

class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer) # 1 to 8
    program_id = Column(Integer, ForeignKey("programs.id"))
    program = relationship("Program", back_populates="semesters")
    is_active = Column(Boolean, default=True)
    subjects = relationship("Subject", back_populates="semester")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    type = Column(String) # Theory, Lab
    credits = Column(Integer)
    weekly_hours = Column(Integer, default=3)
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    semester = relationship("Semester", back_populates="subjects")
    department_id = Column(Integer, ForeignKey("departments.id"))

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True)
    room_name = Column(String)
    floor = Column(String)
    building = Column(String)
    type = Column(String) # Classroom, Lab
    capacity = Column(Integer)
    department = Column(String)
    status = Column(String, default="AVAILABLE")

class AcademicSetting(Base):
    __tablename__ = "academic_settings"
    id = Column(Integer, primary_key=True)
    academic_year = Column(String) # e.g., 2023-2024
    semester_type = Column(String) # Odd, Even
    is_active = Column(Boolean, default=True)

class WorkingDay(Base):
    __tablename__ = "working_days"
    id = Column(Integer, primary_key=True)
    day_name = Column(String, unique=True)
    is_working = Column(Boolean, default=True)

class PeriodTiming(Base):
    __tablename__ = "period_timings"
    id = Column(Integer, primary_key=True)
    period_number = Column(Integer)
    start_time = Column(String) # HH:MM
    end_time = Column(String)
    is_break = Column(Boolean, default=False) # For Lunch Break

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime)
    occasion = Column(String)

class Timetable(Base):
    __tablename__ = "timetables"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    program_id = Column(Integer, ForeignKey("programs.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    day_of_week = Column(String)
    period_id = Column(Integer, ForeignKey("period_timings.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    faculty_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    status = Column(String, default="PENDING") # PENDING, APPROVED
    
    subject = relationship("Subject")
    faculty = relationship("User")
    room = relationship("Room")
    period = relationship("PeriodTiming")

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    faculty_user_id = Column(Integer, ForeignKey("users.id"))
    faculty_id_display = Column(String)
    faculty_name = Column(String)
    department = Column(String)
    subject = Column(String)
    section = Column(String)
    date = Column(String)
    start_time_display = Column(String)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    remarks = Column(String)
    status = Column(String, default="ACTIVE")

    room = relationship("Room")
    faculty = relationship("User")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    faculty_name = Column(String)
    department = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="BOOKED")

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

class Schedule(Base): # Keeping existing for backward compatibility if any
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    subject = Column(String)
    time_slot = Column(String)
    day_of_week = Column(String)

    faculty = relationship("User")
    room = relationship("Room")
