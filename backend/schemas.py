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
    phone: Optional[str] = None
    status: Optional[str] = "Active"

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
    status: Optional[str] = None
    password: Optional[str] = None

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

class DepartmentBase(BaseModel):
    code: Optional[str] = None
    name: str
    classification: Optional[str] = None
    semester: Optional[str] = None
    status: Optional[str] = "Active"

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class ProgramBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: str
    department_id: int
    status: Optional[str] = "Active"

class Program(ProgramBase):
    id: int
    class Config:
        from_attributes = True

class SemesterBase(BaseModel):
    number: int
    program_id: int
    name: Optional[str] = None
    academic_year: Optional[str] = None
    odd_even: Optional[str] = "Odd"
    status: Optional[str] = "Active"

class Semester(SemesterBase):
    id: int
    class Config:
        from_attributes = True

class SectionBase(BaseModel):
    name: str
    semester_id: int
    student_strength: Optional[int] = 60
    status: Optional[str] = "Active"

class SectionCreate(SectionBase):
    pass

class Section(SectionBase):
    id: int
    class Config:
        from_attributes = True

class SubjectBase(BaseModel):
    name: str
    code: str
    type: str
    credits: int
    weekly_hours: int
    status: Optional[str] = "Active"

class SubjectCreate(SubjectBase):
    semester_id: Optional[int] = None
    department_id: Optional[int] = None

class Subject(SubjectBase):
    id: int
    semester_id: Optional[int] = None
    class Config:
        from_attributes = True

class CurriculumBase(BaseModel):
    semester_id: int
    subject_id: int
    weekly_hours: int
    status: Optional[str] = "Active"

class Curriculum(CurriculumBase):
    id: int
    class Config:
        from_attributes = True

class RoomBase(BaseModel):
    room_number: str
    type: str
    capacity: int
    building: Optional[str] = None
    floor: Optional[str] = None
    status: Optional[str] = "AVAILABLE"

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    class Config:
        from_attributes = True

class TimetableSettingBase(BaseModel):
    academic_year: str
    working_days: List[str]
    total_periods_per_day: int
    lab_continuous: bool
    active_semester_id: Optional[int] = None

class TimetableSetting(TimetableSettingBase):
    id: int
    class Config:
        from_attributes = True

class TimetableBase(BaseModel):
    day_of_week: str
    period_id: int
    subject_name: str
    faculty_name: str
    room_number: str
    semester_number: Optional[int] = None
    section: Optional[str] = None

class Timetable(TimetableBase):
    id: int
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    room_id: Optional[int] = None
    semester_id: Optional[int] = None
    class Config:
        from_attributes = True

class FacultyAssignmentBase(BaseModel):
    faculty_id: int
    subject_id: int
    semester_id: Optional[int] = None
    section: Optional[str] = None

class FacultyAssignment(FacultyAssignmentBase):
    id: int
    class Config:
        from_attributes = True

class AuditLog(BaseModel):
    id: int
    user_id: int
    action: str
    resource: str
    details: str
    timestamp: datetime
    class Config:
        from_attributes = True

class FacultyLeave(BaseModel):
    id: int
    faculty_id: int
    start_date: datetime
    end_date: datetime
    status: str
    class Config:
        from_attributes = True

class Substitution(BaseModel):
    id: int
    timetable_id: int
    substitute_faculty_id: int
    status: str
    class Config:
        from_attributes = True

class Booking(BaseModel):
    id: int
    user_id: int
    room_id: int
    start_time: datetime
    end_time: datetime
    class Config:
        from_attributes = True
