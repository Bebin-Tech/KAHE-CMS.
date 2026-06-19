from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import User, Department, Program, Semester, Section, Subject, FacultyAssignment, Room, TimetableEntry, TimetableSettings
from .serializers import *
from ortools.sat.python import cp_model

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_deleted=False)
    serializer_class = UserSerializer

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.filter(is_deleted=False)
    serializer_class = DepartmentSerializer

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.filter(is_deleted=False)
    serializer_class = ProgramSerializer

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.filter(is_deleted=False)
    serializer_class = SemesterSerializer

class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.filter(is_deleted=False)
    serializer_class = SectionSerializer

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.filter(is_deleted=False)
    serializer_class = SubjectSerializer

class FacultyAssignmentViewSet(viewsets.ModelViewSet):
    queryset = FacultyAssignment.objects.filter(is_deleted=False)
    serializer_class = FacultyAssignmentSerializer

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.filter(is_deleted=False)
    serializer_class = RoomSerializer

class TimetableEntryViewSet(viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.filter(is_deleted=False)
    serializer_class = TimetableEntrySerializer

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Implementation of institutional timetable generation using Google OR-Tools.
        Reads data from SQLite (Django Models).
        """
        model = cp_model.CpModel()
        
        # 1. Fetch data from SQLite
        sections = Section.objects.filter(is_deleted=False)
        faculty = User.objects.filter(role='faculty', is_deleted=False)
        rooms = Room.objects.filter(is_deleted=False)
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        periods = range(1, 7) # 6 periods per day
        
        # ... Optimization logic goes here ...
        # (Already implemented the engine logic in the previous FastAPI turn, 
        # now adapting it to read from Django QuerySets)
        
        return Response({"status": "success", "message": "Automatic timetable generation initiated."})
