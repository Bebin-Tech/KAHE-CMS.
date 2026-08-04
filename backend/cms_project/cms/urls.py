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
router.register(r'bookings', BookingViewSet)
router.register(r'audit-logs', AuditLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('login/', login_view),
    path('register-student/', register_student),
    path('account/reset-password/', reset_own_password),
    path('logout/', logout_view),
    path('users_list/', users_list),
    path('dashboard-stats/', dashboard_stats),
    path('class-history/', class_history),
    path('bulk-import-faculty/', bulk_import_faculty),
    path('room-blocks/', get_room_blocks),
    path('live-rooms/', get_live_rooms),
    path('find-class/', find_class),
    path('start-session/', start_session),
    path('end-session/', end_session),
    path('classroom-availability/', get_classroom_availability),
    path('reports/<str:format>/classroom-utilization/', get_classroom_utilization_report),
    path('reports/<str:format>/lab-utilization/', get_classroom_utilization_report),
]
