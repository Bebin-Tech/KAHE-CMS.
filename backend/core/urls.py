from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import *

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'departments', DepartmentViewSet)
router.register(r'programs', ProgramViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'sections', SectionViewSet)
router.register(r'subjects', SubjectViewSet)
router.register(r'faculty-assignments', FacultyAssignmentViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'timetables', TimetableEntryViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
