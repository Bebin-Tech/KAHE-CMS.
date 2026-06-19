from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

from sqlalchemy import true


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    faculty_id: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    max_hours_per_day: Optional[int] = 6
    max_hours_per_week: Optional[int] = 24
    availability_status: Optional[str] = "Available"
    status: Optional[str] = "Active"
    is_deleted: Optional[bool] = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    faculty_id: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    max_hours_per_day: Optional[int] = None
    max_hours_per_week: Optional[int] = None
    availability_status: Optional[str] = None
    status: Optional[str] = None

class User(UserBase):
    id: int
    last_login: Optional[datetime] = None
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
    is_deleted: Optional[bool] = False

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    class Config:
        from_attributes = True

class DepartmentBase(BaseModel):
    code: Optional[str] = None
    name: str
    classification: Optional[str] = None
    semester: Optional[str] = None
    hod_id: Optional[int] = None
    status: Optional[str] = "Active"

class DepartmentUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    classification: Optional[str] = None
    semester: Optional[str] = None
    hod_id: Optional[int] = None
    status: Optional[str] = None

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class ProgramBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: Optional[str] = "UG" # UG, PG
    regulation: Optional[str] = "2023"
    duration: Optional[int] = 3
    department_id: int
    status: Optional[str] = "Active"

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    regulation: Optional[str] = None
    duration: Optional[int] = None
    department_id: Optional[int] = None
    status: Optional[str] = None

class Program(ProgramBase):
    id: int
    class Config:
        from_attributes = True

class SemesterBase(BaseModel):
    number: int
    program_id: int
    name: Optional[str] = None
    academic_year: Optional[str] = None
    odd_even: Optional[str] = None
    status: Optional[str] = "Active"
    is_active: Optional[bool] = True

class SemesterUpdate(BaseModel):
    number: Optional[int] = None
    program_id: Optional[int] = None
    name: Optional[str] = None
    academic_year: Optional[str] = None
    odd_even: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

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
    is_deleted: Optional[bool] = False

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

class SectionBase(BaseModel):
    name: str
    program_id: Optional[int] = None
    semester_id: int
    student_strength: Optional[int] = 60
    assigned_room_id: Optional[int] = None
    status: Optional[str] = "Active"

class SectionCreate(SectionBase):
    pass

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    program_id: Optional[int] = None
    semester_id: Optional[int] = None
    student_strength: Optional[int] = None
    assigned_room_id: Optional[int] = None
    status: Optional[str] = None

class Section(SectionBase):
    id: int
    is_deleted: bool
    class Config:
        from_attributes = True

class FacultyWorkloadBase(BaseModel):
    faculty_id: int
    academic_year: Optional[str] = None
    semester_type: Optional[str] = None
    total_hours_weekly: int = 0
    total_hours_monthly: int = 0
    utilization_percentage: float = 0.0

class FacultyWorkload(FacultyWorkloadBase):
    id: int
    class Config:
        from_attributes = True

class Subject(SubjectBase):
    id: int
    preferred_faculty_id: Optional[int] = None
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
    is_deleted: Optional[bool] = False

class TimetableUpdate(BaseModel):
    day_of_week: Optional[str] = None
    period_id: Optional[int] = None
    room_id: Optional[int] = None
    faculty_id: Optional[int] = None
    status: Optional[str] = None

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
    is_deleted: Optional[bool] = False
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
    is_deleted: Optional[bool] = False
    class Config:
        from_attributes = True

class FacultyAssignmentBase(BaseModel):
    faculty_id: int
    subject_id: int
    semester_id: Optional[int] = None
    section: Optional[str] = None
    section_id: Optional[int] = None

class FacultyAssignmentUpdate(BaseModel):
    faculty_id: Optional[int] = None
    subject_id: Optional[int] = None
    semester_id: Optional[int] = None
    section: Optional[str] = None
    section_id: Optional[int] = None

class CurriculumBase(BaseModel):
    department_id: int
    program_id: int
    semester_id: int
    subject_id: int
    weekly_hours: int
    status: Optional[str] = "Active"

class CurriculumUpdate(BaseModel):
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    weekly_hours: Optional[int] = None
    status: Optional[str] = None

class Curriculum(CurriculumBase):
    id: int
    department: Optional[Department] = None
    program: Optional[Program] = None
    semester: Optional[Semester] = None
    subject: Optional[Subject] = None
    class Config:
        from_attributes = True

class TimetableSettingBase(BaseModel):
    working_days: List[str]
    total_periods_per_day: int = 6
    lab_continuous: bool = True
    academic_year: str
    active_semester_id: Optional[int] = None

class TimetableSetting(TimetableSettingBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    action: str
    resource: str
    resource_id: Optional[int] = None
    details: str

class AuditLog(AuditLogBase):
    id: int
    user_id: int
    timestamp: datetime
    class Config:
        from_attributes = True

class FacultyLeaveBase(BaseModel):
    faculty_id: int
    start_date: datetime
    end_date: datetime
    reason: str

class FacultyLeave(FacultyLeaveBase):
    id: int
    status: str
    applied_at: datetime
    class Config:
        from_attributes = True

class SubstitutionBase(BaseModel):
    original_faculty_id: int
    substitute_faculty_id: int
    timetable_id: int
    date: datetime

class Substitution(SubstitutionBase):
    id: int
    status: str
    class Config:
        from_attributes = True

class FacultyAssignment(FacultyAssignmentBase):
    id: int
    faculty: Optional[User] = None
    subject: Optional[Subject] = None
    class Config:
        from_attributes = True

