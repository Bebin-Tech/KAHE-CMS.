from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    faculty_id: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    max_hours_per_day: Optional[int] = 6
    max_hours_per_week: Optional[int] = 24
    availability_status: Optional[str] = "Available"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    faculty_id: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    password: Optional[str] = None
    max_hours_per_day: Optional[int] = None
    max_hours_per_week: Optional[int] = None
    availability_status: Optional[str] = None

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    name: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class RoomBase(BaseModel):
    room_number: str
    room_name: Optional[str] = None
    floor: Optional[str] = None
    building: Optional[str] = None
    type: str
    capacity: int
    department_id: Optional[int] = None
    department: Optional[str] = None
    status: str = "AVAILABLE"

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    class Config:
        from_attributes = True

class DepartmentBase(BaseModel):
    code: Optional[str] = None
    name: str

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class ProgramBase(BaseModel):
    name: str
    type: str # UG, PG
    department_id: int

class Program(ProgramBase):
    id: int
    class Config:
        from_attributes = True

class SemesterBase(BaseModel):
    number: int
    program_id: int
    is_active: Optional[bool] = True

class Semester(SemesterBase):
    id: int
    class Config:
        from_attributes = True

class SubjectBase(BaseModel):
    name: str
    code: Optional[str] = "N/A"
    type: Optional[str] = "Theory" # Theory, Lab
    credits: Optional[int] = 0
    weekly_hours: Optional[int] = 3
    semester_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    status: Optional[str] = "Active"

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    credits: Optional[int] = None
    weekly_hours: Optional[int] = None
    semester_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    status: Optional[str] = None

class Subject(SubjectBase):
    id: int
    class Config:
        from_attributes = True

class AcademicSettingBase(BaseModel):
    academic_year: str
    semester_type: str # Odd, Even

class AcademicSetting(AcademicSettingBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class WorkingDayBase(BaseModel):
    day_name: str
    is_working: bool

class WorkingDay(WorkingDayBase):
    id: int
    class Config:
        from_attributes = True

class PeriodTimingBase(BaseModel):
    period_number: int
    start_time: str
    end_time: str
    is_break: Optional[bool] = False
    type: str = "CLASS" # CLASS, BREAK, LUNCH

class PeriodTiming(PeriodTimingBase):
    id: int
    class Config:
        from_attributes = True

class HolidayBase(BaseModel):
    date: datetime
    occasion: str

class Holiday(HolidayBase):
    id: int
    class Config:
        from_attributes = True

class TimetableBase(BaseModel):
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    semester_id: Optional[int] = None
    day_of_week: str
    period_id: Optional[int] = None
    time_slot: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_type: Optional[str] = None
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    room_id: Optional[int] = None
    room_number: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    semester_number: Optional[int] = None

class Timetable(TimetableBase):
    id: int
    status: str
    approval_comments: Optional[str] = None
    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_departments: int
    total_programs: int
    total_semesters: int
    total_subjects: int
    total_faculties: int
    total_classrooms: int
    total_labs: int
    generated_timetables: int
    pending_approvals: int
    approved_timetables: int
    published_timetables: int
    conflict_alerts: int

class BookingBase(BaseModel):
    room_id: int
    faculty_name: str
    department: str
    start_time: datetime
    end_time: datetime

class BookingCreate(BookingBase):
    pass

class Booking(BookingBase):
    id: int
    user_id: int
    status: str
    class Config:
        from_attributes = True

class ClassSessionBase(BaseModel):
    room_id: int
    faculty_id_display: str
    faculty_name: str
    department: str
    subject: str
    section: str
    date: str
    start_time_display: Optional[str] = None
    remarks: Optional[str] = None

class ClassSessionCreate(ClassSessionBase):
    pass

class ClassSession(ClassSessionBase):
    id: int
    faculty_user_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    class Config:
        from_attributes = True

class FacultyAssignmentBase(BaseModel):
    faculty_id: int
    subject_id: int
    semester_id: Optional[int] = None
    section: Optional[str] = None

class FacultyAssignment(FacultyAssignmentBase):
    id: int
    faculty: User
    subject: Subject
    class Config:
        from_attributes = True
