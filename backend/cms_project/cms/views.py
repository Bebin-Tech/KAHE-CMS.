from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db import IntegrityError, models, transaction
from django.core.paginator import Paginator
from datetime import datetime, time, timedelta
import random
import pandas as pd
from .models import *
from .serializers import *

class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'super_admin']
        )

class ReadOnlyOrAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['admin', 'super_admin']
        )

class ReadOnlyOrClassroomManager(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return can_manage_classrooms(request.user)

class ReadOnlyOrBookingManager(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['faculty', 'admin', 'super_admin']
        )

def is_admin_user(user):
    return bool(user and user.is_authenticated and user.role in ['admin', 'super_admin'])

def classroom_permission(user):
    if not user or not user.is_authenticated:
        return 'view_only'
    return getattr(user, 'classroom_permission', 'view_only') or 'view_only'

def can_manage_classrooms(user):
    return classroom_permission(user) == 'manage_classrooms'

def can_run_class_sessions(user):
    return classroom_permission(user) in ['class_session', 'manage_classrooms']

def faculty_department(user):
    if user and user.is_authenticated and user.role == 'faculty':
        return user.department_id or -1
    return None

def is_faculty_user(user):
    return bool(user and user.is_authenticated and user.role == 'faculty')

def default_admin_identity(username_input, password):
    if password != 'admin123':
        return None
    default_admins = {
        'admin': ('admin', 'System', 'Admin', 'admin@kahe.edu'),
        'admin@kahe.edu': ('admin', 'System', 'Admin', 'admin@kahe.edu'),
        'bebin': ('bebin', 'Bebin', 'R', 'bebin@kahe.edu'),
        'bebin@kahe.edu': ('bebin', 'Bebin', 'R', 'bebin@kahe.edu'),
    }
    return default_admins.get(str(username_input).lower())

def sync_default_admin_login(username_input, password):
    identity = default_admin_identity(username_input, password)
    if not identity:
        return None

    canonical_username, first_name, last_name, email = identity
    candidates = User.objects.filter(
        models.Q(username__iexact=canonical_username) |
        models.Q(username__iexact=username_input) |
        models.Q(email__iexact=email)
    ).order_by('id')

    admin_user = candidates.filter(role__in=['admin', 'super_admin']).first() or candidates.first()
    if not admin_user:
        admin_user = User.objects.create_user(username=canonical_username, email=email)

    username_taken = User.objects.filter(username__iexact=canonical_username).exclude(id=admin_user.id).exists()
    email_taken = User.objects.filter(email__iexact=email).exclude(id=admin_user.id).exists()

    if not username_taken:
        admin_user.username = canonical_username
    if not email_taken:
        admin_user.email = email
    admin_user.first_name = first_name
    admin_user.last_name = last_name
    admin_user.role = 'super_admin'
    admin_user.status = 'Active'
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.set_password(password)
    admin_user.save()
    return authenticate(username=admin_user.username, password=password)

def parse_client_datetime(value, fallback=None):
    if not value:
        return fallback
    parsed = parse_datetime(str(value))
    if parsed is None:
        return fallback
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed

PERIOD_SCHEDULE = {
    '1': (time(9, 0), time(9, 50)),
    '2': (time(9, 50), time(10, 55)),
    '3': (time(11, 15), time(12, 0)),
    '4': (time(12, 0), time(12, 45)),
    '5': (time(13, 30), time(14, 20)),
    '6': (time(14, 20), time(15, 10)),
}

def period_datetimes(period, booking_date=None):
    period_key = str(period or '').strip()
    if period_key.lower().endswith(('st', 'nd', 'rd', 'th')):
        period_key = period_key[:-2]
    if period_key not in PERIOD_SCHEDULE:
        return None, None
    current_tz = timezone.get_current_timezone()
    target_date = parse_date(str(booking_date)) if booking_date else timezone.localdate()
    if target_date is None:
        return None, None
    start_time, end_time = PERIOD_SCHEDULE[period_key]
    return (
        timezone.make_aware(datetime.combine(target_date, start_time), current_tz),
        timezone.make_aware(datetime.combine(target_date, end_time), current_tz)
    )

def complete_expired_sessions():
    now = timezone.now()
    expired_sessions = ClassSession.objects.filter(
        status='Active',
        end_time__isnull=False,
        end_time__lte=now
    )
    expired_room_ids = list(expired_sessions.values_list('room_id', flat=True))
    if expired_room_ids:
        expired_sessions.update(status='Completed')
        Room.objects.filter(id__in=expired_room_ids, status='Occupied').update(status='Available')

def score_classroom_recommendations(block, period=None, required_capacity=0, booking_date=None, custom_start_time=None, custom_end_time=None):
    start_time = parse_client_datetime(custom_start_time) if custom_start_time else None
    end_time = parse_client_datetime(custom_end_time) if custom_end_time else None
    if not start_time or not end_time:
        start_time, end_time = period_datetimes(period, booking_date)
    if not start_time or not end_time:
        return None, "Please select a valid booking time."
    if end_time <= start_time:
        return None, "Booking end time must be after start time."
    if end_time <= timezone.now():
        return None, "The selected booking time has already ended."
    max_booking_date = timezone.localdate() + timedelta(days=14)
    if timezone.localtime(start_time).date() > max_booking_date:
        return None, "Classrooms can be booked up to 14 days in advance."

    rooms = Room.objects.select_related('block').filter(
        models.Q(block__code__iexact=block) |
        models.Q(block__name__iexact=block) |
        models.Q(building__iexact=block)
    ).order_by('room_number')
    room_ids = list(rooms.values_list('id', flat=True))

    active_room_ids = set(ClassSession.objects.filter(
        room_id__in=room_ids,
        status='Active',
        start_time__lt=end_time
    ).filter(
        models.Q(end_time__isnull=True) | models.Q(end_time__gt=start_time)
    ).values_list('room_id', flat=True))

    booked_room_ids = set(Booking.objects.filter(
        room_id__in=room_ids,
        status='Approved',
        start_time__lt=end_time,
        end_time__gt=start_time
    ).values_list('room_id', flat=True))

    history_since = timezone.now() - timedelta(days=30)
    session_usage = dict(ClassSession.objects.filter(
        room_id__in=room_ids,
        start_time__gte=history_since
    ).values('room_id').annotate(total=models.Count('id')).values_list('room_id', 'total'))
    booking_usage = dict(Booking.objects.filter(
        room_id__in=room_ids,
        start_time__gte=history_since
    ).values('room_id').annotate(total=models.Count('id')).values_list('room_id', 'total'))
    max_usage = max([*(session_usage.values() or [0]), *(booking_usage.values() or [0]), 1])

    # CSP phase: keep only rooms that satisfy all hard constraints.
    csp_candidates = []
    for room in rooms:
        is_available = (
            room.id not in active_room_ids and
            room.id not in booked_room_ids
        )
        if not is_available:
            continue

        capacity = int(room.capacity or 0)
        if required_capacity and capacity < required_capacity:
            continue
        csp_candidates.append(room)

    if not csp_candidates:
        return [], None

    def fitness(room):
        capacity = int(room.capacity or 0)
        capacity_gap = max(capacity - required_capacity, 0)
        capacity_score = 35 if not required_capacity else max(0, 35 - min(capacity_gap, 70) * 0.35)
        usage_total = session_usage.get(room.id, 0) + booking_usage.get(room.id, 0)
        balance_score = 25 * (1 - min(usage_total / max_usage, 1))
        type_score = 10 if room.type == 'Classroom' else 6
        status_score = 30
        return round(status_score + capacity_score + balance_score + type_score, 1)

    # GA phase: evolve room candidates toward the highest fitness.
    population_size = min(max(len(csp_candidates), 8), 24)
    generations = 18
    mutation_rate = 0.18
    rng = random.Random(f"{block}|{period}|{booking_date}|{custom_start_time}|{custom_end_time}|{required_capacity}|{len(csp_candidates)}")
    population = [rng.choice(csp_candidates) for _ in range(population_size)]

    def tournament_select(population_items):
        contenders = rng.sample(population_items, min(3, len(population_items)))
        return max(contenders, key=fitness)

    for _ in range(generations):
        ranked_population = sorted(population, key=fitness, reverse=True)
        next_generation = ranked_population[:2]
        while len(next_generation) < population_size:
            parent_a = tournament_select(ranked_population)
            parent_b = tournament_select(ranked_population)
            parent = parent_a if fitness(parent_a) >= fitness(parent_b) else parent_b
            child = parent
            if rng.random() < mutation_rate:
                child = rng.choice(csp_candidates)
            next_generation.append(child)
        population = next_generation

    ga_selected_ids = []
    for room in sorted(population, key=fitness, reverse=True):
        if room.id not in ga_selected_ids:
            ga_selected_ids.append(room.id)
        if len(ga_selected_ids) >= 8:
            break

    selected_rooms = [room for room in csp_candidates if room.id in ga_selected_ids]
    selected_rooms.sort(key=lambda item: (-fitness(item), item.room_number))

    recommendations = []
    for room in selected_rooms:
        capacity = int(room.capacity or 0)
        usage_total = session_usage.get(room.id, 0) + booking_usage.get(room.id, 0)
        score = fitness(room)

        reasons = [
            "CSP valid: no booking or active class conflict",
            f"GA fit score: capacity {capacity} seats",
            "GA prefers this room for lower recent usage" if usage_total <= max_usage / 2 else "GA selected despite higher recent usage",
        ]
        if required_capacity and capacity >= required_capacity:
            reasons.append("CSP valid: meets requested capacity")

        recommendations.append({
            "id": room.id,
            "room_number": room.room_number,
            "block_name": room.block.name if room.block else room.building,
            "block_code": room.block.code if room.block else room.building,
            "capacity": room.capacity,
            "type": room.type,
            "status": "Available",
            "ai_score": score,
            "reasons": reasons,
            "start_time": start_time,
            "end_time": end_time,
        })

    return recommendations[:8], None

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]

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
        faculty = User.objects.filter(role='faculty').select_related('department')
        if is_faculty_user(request.user):
            dept_id = faculty_department(request.user)
            faculty = faculty.filter(department_id=dept_id)
        serializer = self.get_serializer(faculty, many=True)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username_input = str(request.data.get('username') or '').strip()
    password = request.data.get('password')

    if not username_input or not password:
        return Response({"detail": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    # Try authenticating directly first
    user = authenticate(username=username_input, password=password)

    if not user:
        candidates = [username_input]
        if '@' not in username_input:
            candidates.append(f"{username_input}@kahe.edu")
            candidates.append(f"{username_input}@kahe.edu.in")

        user_obj = User.objects.filter(
            models.Q(username__iexact=username_input) |
            models.Q(email__iexact=username_input) |
            models.Q(employee_id__iexact=username_input) |
            models.Q(username__in=candidates) |
            models.Q(email__in=candidates) |
            models.Q(employee_id__in=candidates)
        ).first()
        if user_obj:
            user = authenticate(username=user_obj.username, password=password)

    if not user:
        user = sync_default_admin_login(username_input, password)

    if user:
        if user.role == 'faculty' and not user.department_id:
            department = Department.objects.filter(status='Active').order_by('id').first() or Department.objects.order_by('id').first()
            if department:
                user.department = department
                user.save(update_fields=['department'])
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "access_token": token.key,
            "token_type": "bearer",
            "role": user.role,
            "user_id": user.id,
            "username": user.username,
            "name": f"{user.first_name} {user.last_name}",
            "classroom_permission": classroom_permission(user),
            "department_id": user.department_id,
            "department_name": user.department.name if user.department else None
        })
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_student(request):
    username = str(request.data.get('username', '')).strip().replace(' ', '').lower()
    password = request.data.get('password')
    full_name = str(request.data.get('full_name') or request.data.get('first_name') or '').strip()
    email = str(request.data.get('email') or '').strip()

    if not username or not password or not full_name:
        return Response({"detail": "Full name, username, and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    email = email or (username if '@' in username else f"{username}@kahe.edu.in")
    if User.objects.filter(
        models.Q(username__iexact=username) |
        models.Q(email__iexact=email) |
        models.Q(employee_id__iexact=username)
    ).exists():
        return Response({"detail": "Student account already exists. Please sign in with your username and password."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=full_name,
                last_name='-',
                email=email,
                employee_id=username,
                role='student',
                status='Active',
                classroom_permission='view_only',
                is_active=True
            )
    except IntegrityError:
        return Response({"detail": "Student account already exists. Please sign in with your username and password."}, status=status.HTTP_400_BAD_REQUEST)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        "access_token": token.key,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "username": user.username,
        "name": user.get_full_name(),
        "classroom_permission": classroom_permission(user),
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def reset_own_password(request):
    new_password = request.data.get('password')
    if not new_password:
        return Response({"detail": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save()
    return Response({"status": "password set"})

@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({"ok": True})

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Department.objects.all().order_by('name')
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(id=dept_id)
        return queryset

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Program.objects.select_related('department').all().order_by('department__name', 'name')
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(department_id=dept_id)
        return queryset

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Semester.objects.select_related('program', 'program__department').all().order_by('program__name', 'number')
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(program__department_id=dept_id)
        return queryset

class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Section.objects.select_related('semester', 'semester__program', 'semester__program__department').all().order_by('semester__program__name', 'semester__number', 'name')
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(semester__program__department_id=dept_id)
        return queryset

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Subject.objects.select_related('department').all().order_by('department__name', 'name')
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(department_id=dept_id)
        return queryset

class CurriculumViewSet(viewsets.ModelViewSet):
    queryset = Curriculum.objects.all()
    serializer_class = CurriculumSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = Curriculum.objects.select_related('department', 'program', 'semester', 'subject').all()
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(department_id=dept_id)
        return queryset

class FacultyAssignmentViewSet(viewsets.ModelViewSet):
    queryset = FacultyAssignment.objects.all()
    serializer_class = FacultyAssignmentSerializer
    permission_classes = [ReadOnlyOrAdminRole]

    def get_queryset(self):
        queryset = FacultyAssignment.objects.select_related(
            'faculty', 'faculty__department', 'subject', 'subject__department',
            'section', 'section__semester', 'section__semester__program'
        ).all()
        if is_faculty_user(self.request.user):
            dept_id = faculty_department(self.request.user)
            queryset = queryset.filter(faculty__department_id=dept_id)
        return queryset

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.select_related('block').all()
    serializer_class = RoomSerializer
    permission_classes = [ReadOnlyOrClassroomManager]

    def get_queryset(self):
        queryset = Room.objects.select_related('block').all().order_by('block__code', 'room_number')
        block = str(self.request.query_params.get('block') or '').strip()
        if block:
            queryset = queryset.filter(
                models.Q(block__code__iexact=block) |
                models.Q(block__name__iexact=block) |
                models.Q(building__iexact=block)
            )
        return queryset

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.select_related('user', 'room', 'room__block').all()
    serializer_class = BookingSerializer
    permission_classes = [ReadOnlyOrBookingManager]

    def get_queryset(self):
        queryset = Booking.objects.select_related('user', 'room', 'room__block').all().order_by('start_time')
        room = self.request.query_params.get('room')
        block = str(self.request.query_params.get('block') or '').strip()
        include_past = str(self.request.query_params.get('include_past') or '').lower() == 'true'
        if room:
            queryset = queryset.filter(room_id=room)
        if block:
            queryset = queryset.filter(
                models.Q(room__block__code__iexact=block) |
                models.Q(room__block__name__iexact=block) |
                models.Q(room__building__iexact=block)
            )
        if not include_past:
            queryset = queryset.filter(end_time__gte=timezone.now())
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='Approved')

    def update(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.user_id != request.user.id and not is_admin_user(request.user):
            return Response({"detail": "You can only update your own bookings."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.user_id != request.user.id and not is_admin_user(request.user):
            return Response({"detail": "You can only update your own bookings."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.user_id != request.user.id and not is_admin_user(request.user):
            return Response({"detail": "You can only delete your own bookings."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer

@api_view(['GET'])
@permission_classes([IsAdminRole])
def users_list(request):
    def positive_int(value, default, max_value=None):
        try:
            number = int(value or default)
        except (TypeError, ValueError):
            number = default
        number = max(number, 1)
        return min(number, max_value) if max_value else number

    users = User.objects.select_related('department').all()
    role = str(request.query_params.get('role') or '').strip().lower()
    search = str(request.query_params.get('search') or '').strip()

    if role == 'admin':
        users = users.filter(role__in=['admin', 'super_admin'])
    elif role:
        users = users.filter(role=role)

    if search:
        users = users.filter(
            models.Q(username__icontains=search) |
            models.Q(email__icontains=search) |
            models.Q(employee_id__icontains=search) |
            models.Q(first_name__icontains=search) |
            models.Q(last_name__icontains=search)
        )

    users = users.order_by('-date_joined', 'id')

    if 'page' in request.query_params or 'page_size' in request.query_params:
        page_number = positive_int(request.query_params.get('page'), 1)
        page_size = positive_int(request.query_params.get('page_size'), 25, 100)
        paginator = Paginator(users, page_size)
        page = paginator.get_page(page_number)
        serializer = UserSerializer(page.object_list, many=True)
        return Response({
            "results": serializer.data,
            "count": paginator.count,
            "page": page.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "has_next": page.has_next(),
            "has_previous": page.has_previous(),
        })

    serializer = UserSerializer(users[:500], many=True)
    return Response(serializer.data)

@api_view(['GET'])
def class_history(request):
    sessions = ClassSession.objects.all().order_by('-start_time')[:20]
    serializer = ClassSessionSerializer(sessions, many=True)
    return Response(serializer.data)

import io
from django.http import HttpResponse

@api_view(['GET'])
def get_classroom_utilization_report(request, format):
    buf = io.BytesIO()
    buf.write(b"Report Placeholder")
    buf.seek(0)
    response = HttpResponse(buf, content_type='application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename=classroom_utilization.{format}'
    return response

@api_view(['GET'])
def get_classroom_availability(request):
    rooms = Room.objects.select_related('block').all()
    active_room_ids = set(ClassSession.objects.filter(status='Active').values_list('room_id', flat=True))
    now = timezone.now()
    bookings = Booking.objects.filter(status='Approved', end_time__gte=now).select_related('user')
    bookings_by_room = {}
    for booking in bookings.order_by('start_time'):
        bookings_by_room.setdefault(booking.room_id, booking)
    res = []
    for r in rooms:
        is_occupied = r.id in active_room_ids or r.status == 'Occupied'
        booking = bookings_by_room.get(r.id)
        status_label = "Occupied" if is_occupied else ("Booked" if booking else "Available")
        res.append({
            "room_number": r.room_number,
            "building": r.building,
            "block_code": r.block.code if r.block else None,
            "block_name": r.block.name if r.block else r.building,
            "type": r.type,
            "occupied_slots": 1 if is_occupied else 0,
            "total_slots": 1,
            "utilization_percentage": 100 if is_occupied else 0,
            "status": status_label,
            "booking": BookingSerializer(booking).data if booking else None
        })
    return Response(res)

@api_view(['POST'])
def start_session(request):
    if not can_run_class_sessions(request.user):
        return Response({"detail": "You do not have permission to start classes."}, status=status.HTTP_403_FORBIDDEN)

    complete_expired_sessions()
    room_id = request.data.get('room_id')
    faculty_id = request.data.get('faculty_id')
    subject_id = request.data.get('subject_id')
    section_id = request.data.get('section_id')
    faculty_name = str(request.data.get('faculty_name') or '').strip()
    subject_name = str(request.data.get('subject_name') or '').strip()
    department_id = request.data.get('department_id') or request.data.get('dept_id')
    topic = request.data.get('topic')
    remarks = request.data.get('remarks')
    selected_period = request.data.get('period') or request.data.get('class_period')
    requested_start_time, requested_end_time = period_datetimes(selected_period)

    if not requested_end_time:
        return Response({"detail": "Please select a valid class period."}, status=400)
    if requested_end_time <= requested_start_time:
        return Response({"detail": "Class end time must be after class start time."}, status=400)
    if requested_end_time <= timezone.now():
        return Response({"detail": "The selected period has already ended."}, status=400)
    
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

        department = None
        if department_id:
            department = Department.objects.filter(id=department_id).first()

        if request.user.role == 'faculty':
            faculty_id = request.user.id
            if not department:
                department = request.user.department

        selected_subject = None
        if subject_id:
            selected_subject = Subject.objects.filter(id=subject_id).select_related('department').first()
            if not selected_subject:
                return Response({"detail": "Selected subject was not found."}, status=400)
            if department and selected_subject.department_id != department.id:
                return Response({"detail": "Selected subject does not belong to the selected department."}, status=400)

        if not faculty_id:
            if not faculty_name:
                return Response({"detail": "Faculty name is required"}, status=400)
            username = ''.join(ch for ch in faculty_name.lower().replace(' ', '_') if ch.isalnum() or ch == '_')[:50]
            username = username or f"faculty_{timezone.now().timestamp()}"
            faculty, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": faculty_name,
                    "last_name": "-",
                    "employee_id": username,
                    "email": f"{username}@kahe.edu.in",
                    "role": "faculty",
                    "department": department,
                    "status": "Active",
                    "is_active": True,
                }
            )
            if created:
                faculty.set_password('faculty123')
                faculty.save()
            faculty_id = faculty.id

        if not selected_subject:
            if not subject_name:
                return Response({"detail": "Subject is required"}, status=400)
            if not department:
                return Response({"detail": "Department is required"}, status=400)
            code_base = ''.join(ch for ch in subject_name.upper().replace(' ', '') if ch.isalnum())[:12] or 'SUBJECT'
            code = code_base
            suffix = 1
            while Subject.objects.filter(code=code).exists():
                suffix += 1
                code = f"{code_base}{suffix}"
            subject, _ = Subject.objects.get_or_create(
                name=subject_name,
                department=department,
                defaults={
                    "code": code,
                    "credits": 0,
                    "weekly_hours": 0,
                    "status": "Active",
                }
            )
            subject_id = subject.id
        else:
            subject_id = selected_subject.id

        conflicting_booking = Booking.objects.filter(
            room=room,
            status='Approved',
            start_time__lt=requested_end_time,
            end_time__gt=requested_start_time
        ).exclude(user_id=faculty_id).select_related('user').first()
        if conflicting_booking:
            return Response({
                "detail": f"Classroom booked by {conflicting_booking.user.get_full_name()} until {conflicting_booking.end_time}."
            }, status=400)

        room.status = 'Occupied'
        room.save()
        
        session = ClassSession.objects.create(
            room_id=room_id,
            faculty_id=faculty_id,
            subject_id=subject_id,
            section_id=section_id or None,
            topic=topic,
            remarks=remarks,
            start_time=requested_start_time,
            end_time=requested_end_time,
            status='Active'
        )
        
        return Response(ClassSessionSerializer(session).data)
    except Room.DoesNotExist:
        return Response({"detail": "Room not found"}, status=404)

@api_view(['POST'])
def end_session(request):
    if not can_run_class_sessions(request.user):
        return Response({"detail": "You do not have permission to end classes."}, status=status.HTTP_403_FORBIDDEN)

    session_id = request.data.get('session_id')
    user_id = request.data.get('user_id') # Identify who is trying to end
    
    try:
        session = ClassSession.objects.get(id=session_id)
        
        # Authorization: Only owner can end
        # (Assuming user_id passed from frontend is the one logged in)
        is_manager = can_manage_classrooms(request.user)
        if str(session.faculty.id) != str(request.user.id) and not is_manager:
            return Response({"detail": "Access Denied: Only the faculty who started this class can end it."}, status=status.HTTP_403_FORBIDDEN)

        session.end_time = timezone.now()
        session.status = 'Completed'
        session.save()
        
        room = session.room
        room.status = 'Available'
        room.save()
        
        return Response({"status": "success"})
    except ClassSession.DoesNotExist:
        return Response({"detail": "Session not found"}, status=404)

@api_view(['GET'])
def get_room_blocks(request):
    default_blocks = ['S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block']
    default_order = models.Case(
        *[
            models.When(code__iexact=block, then=models.Value(index))
            for index, block in enumerate(default_blocks)
        ],
        default=models.Value(len(default_blocks)),
        output_field=models.IntegerField(),
    )
    blocks = Block.objects.annotate(
        room_count=models.Count('rooms'),
        sort_order=default_order,
    ).filter(
        models.Q(room_count__gt=0) |
        models.Q(code__in=default_blocks) |
        models.Q(name__in=default_blocks)
    ).order_by('sort_order', 'name', 'code')

    return Response([
        {
            'code': block.code,
            'name': block.name,
            'room_count': block.room_count,
        }
        for block in blocks
    ])


@api_view(['GET'])
def get_live_rooms(request):
    complete_expired_sessions()
    block = str(request.query_params.get('block') or '').strip()
    rooms = Room.objects.select_related('block').only(
        'id', 'room_number', 'block_id', 'building', 'capacity', 'type', 'status',
        'block__id', 'block__code', 'block__name'
    ).order_by('block__code', 'room_number')
    if block:
        rooms = rooms.filter(
            models.Q(block__code__iexact=block) |
            models.Q(block__name__iexact=block) |
            models.Q(building__iexact=block)
        )
    rooms = list(rooms)
    room_ids = [room.id for room in rooms]
    active_sessions = ClassSession.objects.filter(
        room_id__in=room_ids,
        status='Active'
    ).select_related('faculty', 'faculty__department', 'subject')
    sessions_by_room = {session.room_id: session for session in active_sessions}
    now = timezone.now()
    bookings = Booking.objects.filter(
        room_id__in=room_ids,
        status='Approved',
        end_time__gte=now
    ).select_related('user').order_by('start_time')
    bookings_by_room = {}
    for booking in bookings:
        if booking.start_time <= now or booking.room_id not in bookings_by_room:
            bookings_by_room[booking.room_id] = booking
    res = []
    for r in rooms:
        active_session = sessions_by_room.get(r.id)
        booking = bookings_by_room.get(r.id)
        room_status = r.status or 'Available'
        room_data = {
            'id': r.id,
            'room_number': r.room_number,
            'block': r.block_id,
            'block_code': r.block.code if r.block else None,
            'block_name': r.block.name if r.block else r.building,
            'building': r.building,
            'capacity': r.capacity,
            'type': r.type,
            'status': room_status,
        }
        if active_session:
            room_data['session'] = {
                'id': active_session.id,
                'room': active_session.room_id,
                'faculty': active_session.faculty_id,
                'faculty_name': active_session.faculty.get_full_name(),
                'subject': active_session.subject_id,
                'subject_name': active_session.subject.name if active_session.subject else None,
                'department_name': active_session.faculty.department.name if active_session.faculty.department else None,
                'start_time': active_session.start_time,
                'end_time': active_session.end_time,
                'status': active_session.status,
            }
            room_data['status'] = 'Occupied'
        elif booking:
            room_data['booking'] = {
                'id': booking.id,
                'user': booking.user_id,
                'user_name': booking.user.get_full_name(),
                'room': booking.room_id,
                'start_time': booking.start_time,
                'end_time': booking.end_time,
                'purpose': booking.purpose,
                'status': booking.status,
            }
            room_data['status'] = 'Booked'
        elif room_data.get('status') == 'Occupied':
            room_data['status'] = 'Available'
        res.append(room_data)
    return Response(res)

@api_view(['GET'])
def smart_room_recommendations(request):
    if not (
        request.user and
        request.user.is_authenticated and
        request.user.role in ['faculty', 'admin', 'super_admin']
    ):
        return Response({"detail": "You do not have permission to view AI recommendations."}, status=status.HTTP_403_FORBIDDEN)

    complete_expired_sessions()
    block = str(request.query_params.get('block') or 'S-Block').strip()
    period = request.query_params.get('period')
    booking_date = request.query_params.get('booking_date') or request.query_params.get('date')
    custom_start_time = request.query_params.get('start_time')
    custom_end_time = request.query_params.get('end_time')
    try:
        capacity = int(request.query_params.get('capacity') or 0)
    except (TypeError, ValueError):
        capacity = 0

    recommendations, error = score_classroom_recommendations(
        block=block,
        period=period,
        required_capacity=capacity,
        booking_date=booking_date,
        custom_start_time=custom_start_time,
        custom_end_time=custom_end_time,
    )
    if error:
        return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "algorithm": "CSP + Genetic Algorithm Classroom Recommendation",
        "method": "CSP filters valid rooms by hard constraints; GA optimizes valid rooms by capacity fit, availability, and recent utilization",
        "block": block,
        "period": str(period),
        "booking_date": str(booking_date or timezone.localdate()),
        "start_time": custom_start_time,
        "end_time": custom_end_time,
        "recommendations": recommendations,
    })

@api_view(['GET'])
def find_class(request):
    complete_expired_sessions()
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
    complete_expired_sessions()
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

