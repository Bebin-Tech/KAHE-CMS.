from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('principal', 'Principal'),
        ('hod', 'HOD'),
        ('faculty', 'Faculty'),
        ('student', 'Student'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='faculty')
    faculty_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=15, null=True, blank=True)
    department = models.ForeignKey('Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    designation = models.CharField(max_length=100, null=True, blank=True)
    max_hours_per_week = models.IntegerField(default=24)
    availability_status = models.CharField(max_length=50, default='Available')
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"

class Department(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    hod = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='headed_department')
    status = models.CharField(max_length=20, default='Active')
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Program(models.Model):
    TYPE_CHOICES = (('UG', 'Undergraduate'), ('PG', 'Postgraduate'))
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='programs')
    regulation = models.CharField(max_length=10, null=True, blank=True)
    duration = models.IntegerField(default=3)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Semester(models.Model):
    number = models.IntegerField()
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='semesters')
    academic_year = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        unique_together = ('number', 'program')

    def __str__(self):
        return f"{self.program.name} - Sem {self.number}"

class Section(models.Model):
    name = models.CharField(max_length=10) # A, B, C
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='sections')
    student_strength = models.IntegerField(default=60)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.semester} - Section {self.name}"

class Subject(models.Model):
    TYPE_CHOICES = (('Theory', 'Theory'), ('Lab', 'Lab'), ('Elective', 'Elective'), ('VAC', 'Value Added Course'))
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    credits = models.IntegerField(default=3)
    weekly_hours = models.IntegerField(default=3)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='subjects')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.code})"

class Curriculum(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    subjects = models.ManyToManyField(Subject, related_name='curriculums')
    academic_year = models.CharField(max_length=50)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"Curriculum: {self.program.name} - Sem {self.semester.number}"

class FacultyAssignment(models.Model):
    faculty = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='faculty_mappings')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='faculty_mappings')
    is_deleted = models.BooleanField(default=False)

    class Meta:
        unique_together = ('faculty', 'subject', 'section')

class Room(models.Model):
    TYPE_CHOICES = (('Classroom', 'Classroom'), ('Lab', 'Laboratory'), ('Seminar Hall', 'Seminar Hall'))
    room_number = models.CharField(max_length=50, unique=True)
    building = models.CharField(max_length=100)
    floor = models.CharField(max_length=50)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    capacity = models.IntegerField()
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.room_number

class TimetableEntry(models.Model):
    day_of_week = models.CharField(max_length=20)
    period_number = models.IntegerField()
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    faculty = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    section = models.ForeignKey(Section, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default='DRAFT') # DRAFT, PUBLISHED
    is_deleted = models.BooleanField(default=False)

class TimetableSettings(models.Model):
    academic_year = models.CharField(max_length=50)
    semester_type = models.CharField(max_length=10) # ODD, EVEN
    working_days = models.CharField(max_length=255) # Comma separated
    periods_per_day = models.IntegerField(default=6)
    is_active = models.BooleanField(default=True)
