from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'departments', DepartmentViewSet)
router.register(r'programs', ProgramViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'sections', SectionViewSet)
router.register(r'subjects', SubjectViewSet)
router.register(r'curricula', CurriculumViewSet)
router.register(r'faculty-assignments', FacultyAssignmentViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'settings/timetable', TimetableSettingViewSet, basename='timetable-settings')
router.register(r'period-timings', PeriodTimingViewSet)
router.register(r'timetables', TimetableViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'audit-logs', AuditLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('login/', login_view),
    path('logout/', logout_view),
    path('users_list/', users_list),
    path('dashboard-stats/', dashboard_stats),
    path('class-history/', class_history),
    path('timetable-conflicts/', timetable_conflicts),
    path('generate-timetable/', generate_timetable),
    path('timetable/readiness/', get_readiness),
    path('working-days/', get_working_days),
    path('period-timings/', get_period_timings),
    path('timetable-approval/', timetable_approval),
    path('swap-slots/', swap_slots),
    path('bulk-import-faculty/', bulk_import_faculty),
    path('live-rooms/', get_live_rooms),
    path('start-session/', start_session),
    path('end-session/', end_session),
    path('faculty-workload/', get_faculty_workload_json),
    path('classroom-availability/', get_classroom_availability),
    path('reports/department-summary/', get_department_summary_json),
    path('reports/<str:format>/faculty-workload/', get_faculty_workload_report),
    path('reports/<str:format>/classroom-utilization/', get_classroom_utilization_report),
    path('reports/<str:format>/lab-utilization/', get_classroom_utilization_report),
    path('reports/<str:format>/department-summary/', get_department_summary_report),
]
