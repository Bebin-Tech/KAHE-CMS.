from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Time, Table, Text, Float
from sqlalchemy.orm import relationship
try:
    from .database import Base
except ImportError:
    from database import Base
import enum
from datetime import datetime

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DEAN = "dean"
    HOD = "hod"
    FACULTY = "faculty"
    STUDENT = "student"
    STAFF = "staff"
    ACCOUNTS = "accounts"

class RoomType(str, enum.Enum):
    CLASSROOM = "Classroom"
    LAB = "Lab"
    OFFICE = "Office"
    SEMINAR_HALL = "Seminar Hall"

class TimetableStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String, unique=True, index=True, nullable=True) # Employee ID / Username
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    phone = Column(String, nullable=True)
    role = Column(String) # super_admin, admin, hod, faculty, staff, student
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    designation = Column(String, nullable=True)
    
    # Faculty specific
    max_hours_per_day = Column(Integer, default=6)
    max_hours_per_week = Column(Integer, default=24)
    availability_status = Column(String, default="Available") # Available, On Leave
    
    last_login = Column(DateTime, nullable=True)
    status = Column(String, default="Active") # Active, Inactive
    is_deleted = Column(Boolean, default=False)
    
    department = relationship("Department", foreign_keys=[department_id], back_populates="users")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, unique=True, index=True)
    classification = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    hod_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="Active") # Active, Inactive
    is_deleted = Column(Boolean, default=False)
    
    hod = relationship("User", foreign_keys=[hod_id])
    programs = relationship("Program", back_populates="department")
    users = relationship("User", foreign_keys="User.department_id", back_populates="department")

class Program(Base):
    __tablename__ = "programs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True, nullable=True)
    type = Column(String) # UG, PG
    regulation = Column(String, nullable=True) # e.g., 2021, 2023
    duration = Column(Integer, default=3) # in years
    department_id = Column(Integer, ForeignKey("departments.id"))
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    
    department = relationship("Department", back_populates="programs")
    semesters = relationship("Semester", back_populates="program")

class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer)
    name = Column(String, nullable=True)
    academic_year = Column(String, nullable=True)
    odd_even = Column(String, nullable=True)
    status = Column(String, default="Active")
    program_id = Column(Integer, ForeignKey("programs.id"))
    is_deleted = Column(Boolean, default=False)
    program = relationship("Program", back_populates="semesters")
    is_active = Column(Boolean, default=True)
    subjects = relationship("Subject", back_populates="semester")

class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) # A, B, C
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    student_strength = Column(Integer, default=60)
    assigned_room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    
    program = relationship("Program")
    semester = relationship("Semester")
    assigned_room = relationship("Room")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    type = Column(String) # Theory, Lab
    category = Column(String, default="Core") # Core, Elective, Allied, Value Added, Skill Based
    credits = Column(Integer)
    weekly_hours = Column(Integer, default=3)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department_name = Column(String, nullable=True)
    preferred_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    
    semester = relationship("Semester", back_populates="subjects")
    preferred_faculty = relationship("User", foreign_keys=[preferred_faculty_id])

class FacultyWorkload(Base):
    __tablename__ = "faculty_workload"
    id = Column(Integer, primary_key=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    academic_year = Column(String)
    semester_type = Column(String)
    total_hours_weekly = Column(Integer, default=0)
    total_hours_monthly = Column(Integer, default=0)
    utilization_percentage = Column(Float, default=0.0)
    is_deleted = Column(Boolean, default=False)

    faculty = relationship("User")

class FacultyAssignment(Base):
    __tablename__ = "faculty_assignments"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    section = Column(String, nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    faculty = relationship("User")
    subject = relationship("Subject")
    section_ref = relationship("Section")

class Curriculum(Base):
    __tablename__ = "curricula"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    program_id = Column(Integer, ForeignKey("programs.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    weekly_hours = Column(Integer, default=0)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)

    department = relationship("Department")
    program = relationship("Program")
    semester = relationship("Semester")
    subject = relationship("Subject")

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True)
    room_name = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    building = Column(String, nullable=True)
    type = Column(String) # Classroom, Lab, Seminar Hall
    capacity = Column(Integer)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department = Column(String, nullable=True)
    status = Column(String, default="AVAILABLE")
    is_deleted = Column(Boolean, default=False)

class AcademicSetting(Base):
    __tablename__ = "academic_settings"
    id = Column(Integer, primary_key=True)
    academic_year = Column(String) # e.g., 2023-2024
    semester_type = Column(String) # Odd, Even
    is_active = Column(Boolean, default=True)

class TimetableSetting(Base):
    __tablename__ = "timetable_settings"
    id = Column(Integer, primary_key=True)
    working_days = Column(String, default="")
    total_periods_per_day = Column(Integer, default=6)
    lab_continuous = Column(Boolean, default=True)
    academic_year = Column(String)
    active_semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)

    active_semester = relationship("Semester")

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
    is_break = Column(Boolean, default=False)
    type = Column(String, default="CLASS") # CLASS, BREAK, LUNCH

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime)
    occasion = Column(String)

class Timetable(Base):
    __tablename__ = "timetables"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    day_of_week = Column(String)
    period_id = Column(Integer, ForeignKey("period_timings.id"), nullable=True)
    time_slot = Column(String, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    subject_name = Column(String, nullable=True)
    subject_type = Column(String, nullable=True)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    faculty_name = Column(String, nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    room_number = Column(String, nullable=True)
    section = Column(String, nullable=True)
    academic_year = Column(String, nullable=True)
    semester_number = Column(Integer, nullable=True)
    status = Column(String, default="DRAFT") # DRAFT, PENDING, APPROVED, PUBLISHED
    approval_comments = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    subject = relationship("Subject")
    faculty = relationship("User")
    room = relationship("Room")
    period = relationship("PeriodTiming")

class Conflict(Base):
    __tablename__ = "conflicts"
    id = Column(Integer, primary_key=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"))
    conflict_type = Column(String) # Faculty, Room, Lab
    message = Column(String)
    resolved = Column(Boolean, default=False)

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
    is_deleted = Column(Boolean, default=False)

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
    is_deleted = Column(Boolean, default=False)

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

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # CREATE, UPDATE, DELETE, LOGIN, MOVE_PERIOD
    resource = Column(String) # Timetable, Subject, User
    resource_id = Column(Integer, nullable=True)
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)

    user = relationship("User")

class FacultyLeave(Base):
    __tablename__ = "faculty_leaves"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    reason = Column(String)
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    applied_at = Column(DateTime, default=datetime.utcnow)

    faculty = relationship("User")

class Substitution(Base):
    __tablename__ = "substitutions"
    id = Column(Integer, primary_key=True, index=True)
    original_faculty_id = Column(Integer, ForeignKey("users.id"))
    substitute_faculty_id = Column(Integer, ForeignKey("users.id"))
    timetable_id = Column(Integer, ForeignKey("timetables.id"))
    date = Column(DateTime)
    status = Column(String, default="ACTIVE") # ACTIVE, COMPLETED

    original_faculty = relationship("User", foreign_keys=[original_faculty_id])
    substitute_faculty = relationship("User", foreign_keys=[substitute_faculty_id])
    timetable = relationship("Timetable")

class ApprovalWorkflow(Base):
    __tablename__ = "approval_workflows"
    id = Column(Integer, primary_key=True, index=True)
    resource_type = Column(String) # Timetable, Leave
    resource_id = Column(Integer)
    requested_by = Column(Integer, ForeignKey("users.id"))
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="PENDING")
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
