from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Department, Program, Semester, Section, Subject, FacultyAssignment, Room, TimetableEntry, TimetableSettings

class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('role', 'faculty_id', 'department', 'designation', 'max_hours_per_week', 'availability_status', 'is_deleted')}),
    )
    list_display = ['username', 'email', 'role', 'department', 'is_active']
    list_filter = ['role', 'department', 'is_active']

admin.site.register(User, CustomUserAdmin)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'hod', 'status')
    search_fields = ('name', 'code')

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'type', 'department', 'regulation')
    list_filter = ('type', 'department')

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('program', 'number', 'academic_year', 'is_active')
    list_filter = ('program', 'is_active')

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'semester', 'student_strength')
    list_filter = ('semester',)

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'type', 'semester', 'department', 'weekly_hours')
    list_filter = ('type', 'department', 'semester')
    search_fields = ('name', 'code')

@admin.register(FacultyAssignment)
class FacultyAssignmentAdmin(admin.ModelAdmin):
    list_display = ('faculty', 'subject', 'section')
    list_filter = ('faculty', 'section')

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('room_number', 'building', 'floor', 'type', 'capacity')
    list_filter = ('type', 'building')

@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ('day_of_week', 'period_number', 'subject', 'faculty', 'room', 'section', 'status')
    list_filter = ('day_of_week', 'status', 'section')

@admin.register(TimetableSettings)
class TimetableSettingsAdmin(admin.ModelAdmin):
    list_display = ('academic_year', 'semester_type', 'periods_per_day', 'is_active')
