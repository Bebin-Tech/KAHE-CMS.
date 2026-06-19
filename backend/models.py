from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Time, Table, Text, Float
from sqlalchemy.orm import relationship
try:
    from .database import Base
except ImportError:
    from database import Base
import enum
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    phone = Column(String, nullable=True)
    role = Column(String) # super_admin, admin, hod, faculty, staff, student
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    designation = Column(String, nullable=True)
    max_hours_per_day = Column(Integer, default=6)
    max_hours_per_week = Column(Integer, default=24)
    availability_status = Column(String, default="Available")
    last_login = Column(DateTime, nullable=True)
    status = Column(String, default="Active")
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
    status = Column(String, default="Active")
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
    regulation = Column(String, nullable=True)
    duration = Column(Integer, default=3)
    department_id = Column(Integer, ForeignKey("departments.id"))
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    department = relationship("Department", back_populates="programs")
    semesters = relationship("Semester", back_populates="program")

class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer)
    program_id = Column(Integer, ForeignKey("programs.id"))
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    program = relationship("Program", back_populates="semesters")
    subjects = relationship("Subject", back_populates="semester")

class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    student_strength = Column(Integer, default=60)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    semester = relationship("Semester")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    type = Column(String) # Theory, Lab
    credits = Column(Integer)
    weekly_hours = Column(Integer, default=3)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department_name = Column(String, nullable=True)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)
    semester = relationship("Semester", back_populates="subjects")

class Curriculum(Base):
    __tablename__ = "curricula"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    weekly_hours = Column(Integer, default=3)
    status = Column(String, default="Active")
    is_deleted = Column(Boolean, default=False)

class FacultyWorkload(Base):
    __tablename__ = "faculty_workload"
    id = Column(Integer, primary_key=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    total_hours_weekly = Column(Integer, default=0)
    utilization_percentage = Column(Float, default=0.0)
    is_deleted = Column(Boolean, default=False)

class FacultyAssignment(Base):
    __tablename__ = "faculty_assignments"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=True)
    section = Column(String, nullable=True)
    section_id = Column(Integer, nullable=True)
    is_deleted = Column(Boolean, default=False)
    faculty = relationship("User")
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
    department = Column(String, nullable=True)
    status = Column(String, default="AVAILABLE")
    is_deleted = Column(Boolean, default=False)

class TimetableSetting(Base):
    __tablename__ = "timetable_settings"
    id = Column(Integer, primary_key=True)
    academic_year = Column(String)
    working_days = Column(String)
    total_periods_per_day = Column(Integer, default=6)
    lab_continuous = Column(Boolean, default=True)
    active_semester_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)

class PeriodTiming(Base):
    __tablename__ = "period_timings"
    id = Column(Integer, primary_key=True)
    period_number = Column(Integer)
    start_time = Column(String)
    end_time = Column(String)
    is_break = Column(Boolean, default=False)
    type = Column(String, default="CLASS")

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
    semester_number = Column(Integer, nullable=True)
    status = Column(String, default="PUBLISHED")
    is_deleted = Column(Boolean, default=False)
    subject = relationship("Subject")
    faculty = relationship("User")
    room = relationship("Room")

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    faculty_user_id = Column(Integer, ForeignKey("users.id"))
    faculty_name = Column(String)
    subject = Column(String)
    status = Column(String, default="ACTIVE")
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    resource = Column(String)
    resource_id = Column(Integer, nullable=True)
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")

class FacultyLeave(Base):
    __tablename__ = "faculty_leaves"
    id = Column(Integer, primary_key=True)
    faculty_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String, default="PENDING")
    is_deleted = Column(Boolean, default=False)

class Substitution(Base):
    __tablename__ = "substitutions"
    id = Column(Integer, primary_key=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"))
    substitute_faculty_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="ACTIVE")
    is_deleted = Column(Boolean, default=False)

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    is_deleted = Column(Boolean, default=False)
