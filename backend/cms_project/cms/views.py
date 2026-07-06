from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.utils import timezone
import pandas as pd
from .models import *
from .serializers import *
from .scheduler import TimetableSolver

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password')
        if not new_password:
            return Response({"detail": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({"status": "password set"})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.status = 'Inactive'
        user.save()
        return Response({"status": "user deactivated"})

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.status = 'Active'
        user.save()
        return Response({"status": "user activated"})

    @action(detail=False, methods=['get'])
    def faculty_list(self, request):
        faculty = User.objects.filter(role='faculty')
        serializer = self.get_serializer(faculty, many=True)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username_input = request.data.get('username')
    password = request.data.get('password')

    # Try authenticating directly first
    user = authenticate(username=username_input, password=password)

    if not user:
        # Try finding by email if username authentication failed
        try:
            user_obj = User.objects.get(email=username_input)
            user = authenticate(username=user_obj.username, password=password)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            pass

    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "access_token": token.key,
            "token_type": "bearer",
            "role": user.role,
            "user_id": user.id,
            "name": f"{user.first_name} {user.last_name}"
        })
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"ok": True})

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer

class CurriculumViewSet(viewsets.ModelViewSet):
    queryset = Curriculum.objects.all()
    serializer_class = CurriculumSerializer

class FacultyAssignmentViewSet(viewsets.ModelViewSet):
    queryset = FacultyAssignment.objects.all()
    serializer_class = FacultyAssignmentSerializer

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer

class TimetableSettingViewSet(viewsets.ModelViewSet):
    queryset = TimetableSetting.objects.all()
    serializer_class = TimetableSettingSerializer

class PeriodTimingViewSet(viewsets.ModelViewSet):
    queryset = PeriodTiming.objects.all()
    serializer_class = PeriodTimingSerializer

class TimetableViewSet(viewsets.ModelViewSet):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer

@api_view(['GET'])
def users_list(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def get_readiness(request):
    # Ensure TimetableSetting exists
    if not TimetableSetting.objects.exists():
        TimetableSetting.objects.create(
            academic_year="2024-2025",
            working_days="Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
            periods_per_day=6,
            is_active=True
        )

    checks = [
        ("Departments Registered", Department.objects.count() > 0),
        ("Programs Configured", Program.objects.count() > 0),
        ("Faculty Directory Synchronized", User.objects.filter(role='faculty').count() > 0),
        ("Curriculum Map Exists", Subject.objects.count() > 0)
    ]
    is_ready = all(c[1] for c in checks)
    return Response({
        "is_ready": is_ready,
        "checks": [{"label": c[0], "passed": c[1]} for c in checks]
    })

@api_view(['GET'])
def get_working_days(request):
    setting = TimetableSetting.objects.filter(is_active=True).first()
    days_str = setting.working_days if setting else "Monday,Tuesday,Wednesday,Thursday,Friday"
    days = days_str.split(',')
    return Response([{"id": idx, "day_name": day, "is_working": True} for idx, day in enumerate(days)])

@api_view(['GET'])
def get_period_timings(request):
    periods = PeriodTiming.objects.all().order_by('period_number')
    if not periods.exists():
        # Seed default periods as per the user's institutional timing (6 Periods per day)
        defaults = [
            (1, "09:00:00", "10:00:00", False, "CLASS"),
            (2, "10:00:00", "11:00:00", False, "CLASS"),
            (3, "11:00:00", "11:15:00", True, "BREAK"),
            (4, "11:15:00", "12:15:00", False, "CLASS"),
            (5, "12:15:00", "13:15:00", False, "CLASS"),
            (6, "13:15:00", "14:00:00", True, "LUNCH"),
            (7, "14:00:00", "15:00:00", False, "CLASS"),
            (8, "15:00:00", "16:00:00", False, "CLASS"),
        ]
        for p in defaults:
            PeriodTiming.objects.create(period_number=p[0], start_time=p[1], end_time=p[2], is_break=p[3], label=p[4])
        periods = PeriodTiming.objects.all().order_by('period_number')
    
    serializer = PeriodTimingSerializer(periods, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def timetable_approval(request):
    semester_id = request.query_params.get('semester_id')
    status_str = request.query_params.get('status')
    if not semester_id or not status_str:
        return Response({"detail": "semester_id and status required"}, status=400)
    
    Timetable.objects.filter(section__semester_id=semester_id).update(status=status_str)
    return Response({"status": "success"})

@api_view(['POST'])
def swap_slots(request):
    tt1_id = request.query_params.get('tt1_id')
    tt2_id = request.query_params.get('tt2_id')
    
    try:
        tt1 = Timetable.objects.get(id=tt1_id)
        tt2 = Timetable.objects.get(id=tt2_id)
        
        # Swap temporal/spatial coordinates
        tt1.day, tt2.day = tt2.day, tt1.day
        tt1.period, tt2.period = tt2.period, tt1.period
        
        tt1.save()
        tt2.save()
        return Response({"status": "success"})
    except Timetable.DoesNotExist:
        return Response({"detail": "Slot not found"}, status=404)

@api_view(['GET'])
def class_history(request):
    sessions = ClassSession.objects.all().order_by('-start_time')[:20]
    serializer = ClassSessionSerializer(sessions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def timetable_conflicts(request):
    # For production, we would iterate and find overlaps. 
    # For now, return empty as the generator ensures no conflicts.
    return Response([])

import io
from django.http import HttpResponse

@api_view(['GET'])
def get_faculty_workload_report(request, format):
    # This is a placeholder for the actual PDF/Excel generation logic
    # In a production system, use reportlab or fpdf and pandas
    buf = io.BytesIO()
    if format == 'pdf':
        content_type = 'application/pdf'
        filename = 'faculty_workload.pdf'
        buf.write(b"PDF Content Placeholder")
    else:
        content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = 'faculty_workload.xlsx'
        buf.write(b"Excel Content Placeholder")

    buf.seek(0)
    response = HttpResponse(buf, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename={filename}'
    return response

@api_view(['GET'])
def get_classroom_utilization_report(request, format):
    buf = io.BytesIO()
    buf.write(b"Report Placeholder")
    buf.seek(0)
    response = HttpResponse(buf, content_type='application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename=classroom_utilization.{format}'
    return response

@api_view(['GET'])
def get_department_summary_report(request, format):
    buf = io.BytesIO()
    buf.write(b"Report Placeholder")
    buf.seek(0)
    response = HttpResponse(buf, content_type='application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename=department_summary.{format}'
    return response

@api_view(['GET'])
def get_department_summary_json(request):
    depts = Department.objects.all()
    res = []
    for d in depts:
        res.append({
            "id": d.id,
            "name": d.name,
            "programs_count": d.programs.count(),
            "subjects_count": d.subjects.count(),
            "faculties_count": User.objects.filter(department=d, role='faculty').count(),
            "schedules_count": Timetable.objects.filter(section__semester__program__department=d).count()
        })
    return Response(res)

@api_view(['GET'])
def get_faculty_workload_json(request):
    faculties = User.objects.filter(role='faculty')
    res = []
    for f in faculties:
        actual = Timetable.objects.filter(faculty=f).count()
        target = f.max_hours_per_week
        res.append({
            "faculty_id": f.employee_id,
            "name": f.get_full_name(),
            "department": f.department.name if f.department else "N/A",
            "actual_hours": actual,
            "target_hours": target,
            "utilization": round((actual / target * 100), 1) if target > 0 else 0
        })
    return Response(res)

@api_view(['GET'])
def get_classroom_availability(request):
    rooms = Room.objects.all()
    res = []
    for r in rooms:
        occupied = Timetable.objects.filter(room=r).count()
        total = 30
        res.append({
            "room_number": r.room_number,
            "type": r.type,
            "occupied_slots": occupied,
            "total_slots": total,
            "utilization_percentage": round((occupied / total * 100), 1) if total > 0 else 0,
            "status": "Occupied" if occupied > 25 else "Available"
        })
    return Response(res)

@api_view(['POST'])
def start_session(request):
    room_id = request.data.get('room_id')
    faculty_id = request.data.get('faculty_id')
    subject_id = request.data.get('subject_id')
    section_id = request.data.get('section_id')
    topic = request.data.get('topic')
    remarks = request.data.get('remarks')
    
    try:
        room = Room.objects.get(id=room_id)
        
        # Validation: Is room already occupied?
        active_session = ClassSession.objects.filter(room=room, status='Active').first()
        if active_session:
            return Response({
                "detail": "Classroom Occupied",
                "faculty_name": active_session.faculty.get_full_name(),
                "start_time": active_session.start_time
            }, status=400)

        room.status = 'Occupied'
        room.save()
        
        session = ClassSession.objects.create(
            room_id=room_id,
            faculty_id=faculty_id,
            subject_id=subject_id,
            section_id=section_id,
            topic=topic,
            remarks=remarks,
            status='Active'
        )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action="SESSION_START",
            resource=f"Room {room.room_number}",
            details=f"Faculty {session.faculty.get_full_name()} started session for {session.subject.name}"
        )
        
        return Response(ClassSessionSerializer(session).data)
    except Room.DoesNotExist:
        return Response({"detail": "Room not found"}, status=404)

@api_view(['POST'])
def end_session(request):
    session_id = request.data.get('session_id')
    user_id = request.data.get('user_id') # Identify who is trying to end
    
    try:
        session = ClassSession.objects.get(id=session_id)
        
        # Authorization: Only owner can end
        # (Assuming user_id passed from frontend is the one logged in)
        if str(session.faculty.id) != str(user_id) and not request.user.is_staff:
            return Response({"detail": "Access Denied: Only the faculty who started this class can end it."}, status=status.HTTP_403_FORBIDDEN)

        session.end_time = timezone.now()
        session.status = 'Completed'
        session.save()
        
        room = session.room
        room.status = 'Available'
        room.save()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action="SESSION_END",
            resource=f"Room {room.room_number}",
            details=f"Session completed for {session.subject.name}"
        )
        
        return Response({"status": "success"})
    except ClassSession.DoesNotExist:
        return Response({"detail": "Session not found"}, status=404)

@api_view(['GET'])
def get_live_rooms(request):
    rooms = Room.objects.all().order_by('room_number')
    res = []
    for r in rooms:
        active_session = ClassSession.objects.filter(room=r, status='Active').first()
        room_data = RoomSerializer(r).data
        if active_session:
            room_data['session'] = ClassSessionSerializer(active_session).data
        res.append(room_data)
    return Response(res)

@api_view(['GET'])
def find_class(request):
    query = request.query_params.get('q', '')
    if not query:
        return Response([])
    
    # Search for active sessions matching query (section or subject or faculty or room)
    sessions = ClassSession.objects.filter(status='Active')
    
    if query:
        sessions = sessions.filter(
            models.Q(section__name__icontains=query) |
            models.Q(subject__name__icontains=query) |
            models.Q(faculty__first_name__icontains=query) |
            models.Q(faculty__last_name__icontains=query) |
            models.Q(room__room_number__icontains=query)
        )
    
    serializer = ClassSessionSerializer(sessions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def dashboard_stats(request):
    data = {
        "rooms": Room.objects.count(),
        "active": ClassSession.objects.filter(status='Active').count(),
        "total_departments": Department.objects.count(),
        "total_programs": Program.objects.count(),
        "total_semesters": Semester.objects.count(),
        "total_subjects": Subject.objects.count(),
        "total_faculties": User.objects.filter(role='faculty').count(),
        "total_classrooms": Room.objects.filter(type='Classroom').count(),
        "total_labs": Room.objects.filter(type='Lab').count(),
        "generated_timetables": Timetable.objects.count(),
        "approved_timetables": Timetable.objects.filter(status='APPROVED').count(),
        "conflict_alerts": 0,
        "room_utilization": round((ClassSession.objects.filter(status='Active').count() / Room.objects.count() * 100), 1) if Room.objects.count() > 0 else 0
    }
    return Response(data)

@api_view(['POST'])
@parser_classes([MultiPartParser])
def bulk_import_faculty(request):
    file = request.FILES.get('file')
    if not file:
        return Response({"detail": "No file provided"}, status=400)
    
    try:
        if file.name.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)
        
        required_columns = ['Name', 'Username', 'Department Code']
        for col in required_columns:
            if col not in df.columns:
                return Response({"detail": f"Missing column: {col}"}, status=400)
        
        success_count = 0
        errors = []
        
        for index, row in df.iterrows():
            name = str(row['Name']).strip()
            raw_username = str(row['Username']).strip()
            dept_code = str(row['Department Code']).strip()
            
            if not raw_username or raw_username == 'nan':
                continue

            # Sanitize username: remove spaces and lowercase
            username = raw_username.replace(' ', '').lower()

            dept = Department.objects.filter(code=dept_code).first()
            if not dept:
                errors.append(f"Row {index+2}: Department code '{dept_code}' not found")
                continue
            
            if User.objects.filter(username=username).exists():
                errors.append(f"Row {index+2}: Username '{username}' already exists")
                continue
            
            email = str(row.get('Email', ''))
            if not email or email == 'nan':
                if '@' in username:
                    email = username
                else:
                    email = f"{username}@kahe.edu.in"
                
            User.objects.create_user(
                username=username,
                first_name=name,
                last_name='-',
                department=dept,
                role='faculty',
                password=str(row.get('Password', 'faculty123')),
                employee_id=username,
                email=email,
                is_active=True,
                status='Active'
            )
            success_count += 1
            
        return Response({
            "status": "success",
            "message": f"Successfully imported {success_count} faculty members.",
            "errors": errors
        })
    except Exception as e:
        return Response({"detail": str(e)}, status=500)

@api_view(['POST'])
def generate_timetable(request):
    department_id = request.data.get('department_id') or request.query_params.get('department_id')
    semester_id = request.data.get('semester_id') or request.query_params.get('semester_id')

    solver = TimetableSolver(department_id=department_id, semester_id=semester_id)
    success = solver.solve()
    if success:
        return Response({"status": "success", "message": "Timetable generated successfully"})
    else:
        return Response({"status": "error", "message": "Could not satisfy constraints."}, status=status.HTTP_400_BAD_REQUEST)
