from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    faculty_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class RoomBase(BaseModel):
    room_number: str
    type: str
    capacity: int
    department: str
    status: str = "AVAILABLE"

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: int
    class Config:
        from_attributes = True

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
    start_time_display: Optional[str] = None # Added for form input
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

class DepartmentBase(BaseModel):
    name: str

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class SubjectBase(BaseModel):
    name: str
    department_name: str

class Subject(SubjectBase):
    id: int
    class Config:
        from_attributes = True
