from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLES = (
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('hod', 'HOD'),
        ('faculty', 'Faculty'),
        ('student', 'Student'),
        ('staff', 'Staff'),
    )
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLES, default='staff')
    phone = models.CharField(max_length=15, null=True, blank=True)
    department = models.ForeignKey('Department', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, default='Active')
    designation = models.CharField(max_length=100, null=True, blank=True)
    section = models.ForeignKey('Section', on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    
    # Faculty specific
    max_hours_per_day = models.IntegerField(default=6)
    max_hours_per_week = models.IntegerField(default=24)
    availability_status = models.CharField(max_length=20, default='Available')
    classroom_permission = models.CharField(
        max_length=30,
        choices=(
            ('view_only', 'View Only'),
            ('class_session', 'Start / End Class'),
            ('manage_classrooms', 'Create / Edit / Delete Classrooms'),
        ),
        default='view_only',
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.username})"

    class Meta:
        indexes = [
            models.Index(fields=['role', '-date_joined'], name='user_role_joined_idx'),
            models.Index(fields=['role', 'status'], name='user_role_status_idx'),
            models.Index(fields=['email'], name='user_email_idx'),
            models.Index(fields=['is_active'], name='user_active_idx'),
        ]

class Department(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    classification = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=20, default='Active')
    hod = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='department_hod')

    def __str__(self):
        return self.name

class Program(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    duration_years = models.IntegerField(default=3)
    status = models.CharField(max_length=20, default='Active')

    def __str__(self):
        return self.name

class Semester(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='semesters')
    number = models.IntegerField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.program.name} - Sem {self.number}"

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['program', 'number'], name='unique_semester_per_program')
        ]

class Section(models.Model):
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=10)
    student_count = models.IntegerField(default=60)
    status = models.CharField(max_length=20, default='Active')
    tutor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tutored_sections',
        limit_choices_to={'role': 'faculty'},
    )

    def __str__(self):
        return f"{self.semester} - Section {self.name}"

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['semester', 'name'], name='unique_section_per_semester')
        ]

class Subject(models.Model):
    TYPES = (
        ('Theory', 'Theory'),
        ('Lab', 'Lab'),
    )
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    mne = models.CharField(max_length=10, null=True, blank=True) # Mnemonic/Abbreviation
    credits = models.IntegerField()
    syllabus_hours = models.IntegerField(default=0) # Periods as per Syllabus
    allotted_hours = models.IntegerField(default=0) # Allotted Periods
    weekly_hours = models.IntegerField() # Total hours in timetable
    type = models.CharField(max_length=10, choices=TYPES, default='Theory')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    status = models.CharField(max_length=20, default='Active')

    def __str__(self):
        return f"{self.code} - {self.name}"

class Curriculum(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    weekly_hours = models.IntegerField()
    status = models.CharField(max_length=20, default='Active')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'program', 'semester', 'subject'],
                name='unique_curriculum_entry'
            )
        ]

class FacultyAssignment(models.Model):
    faculty = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'faculty'})
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    section = models.ForeignKey(Section, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('faculty', 'subject', 'section')

class FacultyAvailability(models.Model):
    DAYS = (
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
        ('Saturday', 'Saturday'),
    )
    faculty = models.ForeignKey(User, on_delete=models.CASCADE, related_name='availability_slots', limit_choices_to={'role': 'faculty'})
    day = models.CharField(max_length=20, choices=DAYS)
    period = models.ForeignKey('PeriodTiming', on_delete=models.CASCADE)
    is_available = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['faculty', 'day', 'period'], name='unique_faculty_day_period_availability')
        ]
        indexes = [
            models.Index(fields=['faculty', 'day', 'is_available'], name='faculty_day_available_idx'),
        ]

class SectionRoomAssignment(models.Model):
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='home_room_assignment')
    room = models.ForeignKey('Room', on_delete=models.PROTECT, related_name='section_home_assignments')
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='room_assignments_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['room'], name='section_home_room_idx'),
        ]

class Block(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class Room(models.Model):
    TYPES = (
        ('Classroom', 'Classroom'),
        ('Lab', 'Lab'),
        ('Seminar Hall', 'Seminar Hall'),
    )
    room_number = models.CharField(max_length=20)
    block = models.ForeignKey(Block, on_delete=models.PROTECT, related_name='rooms')
    building = models.CharField(max_length=100, null=True, blank=True)
    capacity = models.IntegerField()
    type = models.CharField(max_length=20, choices=TYPES, default='Classroom')
    status = models.CharField(max_length=20, default='Available')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['block', 'room_number'], name='unique_room_per_block')
        ]
        indexes = [
            models.Index(fields=['block', 'room_number'], name='room_block_number_idx'),
            models.Index(fields=['status'], name='room_status_idx'),
        ]

    def __str__(self):
        block_name = self.block.name if self.block else (self.building or 'Main Block')
        return f"{block_name} - {self.room_number}"

class TimetableSetting(models.Model):
    academic_year = models.CharField(max_length=20)
    working_days = models.CharField(max_length=200, default='Monday,Tuesday,Wednesday,Thursday,Friday')
    periods_per_day = models.IntegerField(default=6)
    lab_continuous = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

class PeriodTiming(models.Model):
    period_number = models.IntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_break = models.BooleanField(default=False)
    label = models.CharField(max_length=20, default='CLASS')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['period_number'], name='unique_period_number')
        ]

class Timetable(models.Model):
    day = models.CharField(max_length=20)
    period = models.ForeignKey(PeriodTiming, on_delete=models.CASCADE)
    section = models.ForeignKey(Section, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    faculty = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default='Published')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['day', 'period', 'section'], name='unique_section_day_period'),
            models.UniqueConstraint(fields=['day', 'period', 'faculty'], name='unique_faculty_day_period'),
            models.UniqueConstraint(fields=['day', 'period', 'room'], name='unique_room_day_period'),
        ]
        indexes = [
            models.Index(fields=['day', 'period'], name='timetable_day_period_idx'),
            models.Index(fields=['section', 'day'], name='timetable_section_day_idx'),
            models.Index(fields=['faculty', 'day'], name='timetable_faculty_day_idx'),
        ]

class ClassSession(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    faculty = models.ForeignKey(User, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, null=True, blank=True)
    topic = models.CharField(max_length=255, null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='Active')

    def __str__(self):
        return f"{self.room.room_number} - {self.faculty.get_full_name()} ({self.status})"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['room'],
                condition=models.Q(status='Active'),
                name='unique_active_session_per_room'
            )
        ]
        indexes = [
            models.Index(fields=['room', 'status'], name='session_room_status_idx'),
            models.Index(fields=['faculty', 'status'], name='session_faculty_status_idx'),
        ]

class Booking(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    purpose = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='Approved')

    class Meta:
        indexes = [
            models.Index(fields=['room', 'start_time', 'end_time'], name='booking_room_time_idx'),
            models.Index(fields=['user', 'status'], name='booking_user_status_idx'),
        ]

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=100)
    resource = models.CharField(max_length=100)
    details = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=160)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at'], name='notification_user_read_idx'),
        ]

class AutomationRun(models.Model):
    SCOPE_CHOICES = (
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('custom', 'Custom'),
    )
    STATUS_CHOICES = (
        ('Completed', 'Completed'),
        ('Partial', 'Partial'),
        ('Failed', 'Failed'),
    )
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='automation_runs')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='weekly')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    generated_timetables = models.IntegerField(default=0)
    generated_notifications = models.IntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['-created_at'], name='automation_run_created_idx'),
        ]
