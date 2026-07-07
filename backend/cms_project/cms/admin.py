from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import *

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'employee_id', 'department', 'status')
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('role', 'employee_id', 'department', 'status', 'phone', 'designation', 'max_hours_per_day', 'max_hours_per_week', 'availability_status')}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(Department)
admin.site.register(Program)
admin.site.register(Semester)
admin.site.register(Section)
admin.site.register(Subject)
admin.site.register(Curriculum)
admin.site.register(FacultyAssignment)
admin.site.register(Room)
admin.site.register(ClassSession)
admin.site.register(Booking)
admin.site.register(AuditLog)
