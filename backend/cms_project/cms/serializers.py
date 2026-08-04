from rest_framework import serializers
from django.db import models
from django.utils import timezone
from .models import *

class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'employee_id', 'role', 'phone', 'department', 'department_name',
            'status', 'designation', 'password', 'is_active',
            'max_hours_per_day', 'max_hours_per_week', 'availability_status',
            'classroom_permission', 'date_joined'
        )
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'username': {'required': True}
        }

    def create(self, validated_data):
        role = validated_data.get('role', 'staff')
        if role == 'faculty' and not validated_data.get('department'):
            raise serializers.ValidationError({"department": "Faculty users must be assigned to a department."})
        if not validated_data.get('classroom_permission'):
            validated_data['classroom_permission'] = self.default_classroom_permission(role)
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_password('faculty123')
        user.is_active = True
        user.save()
        return user

    def update(self, instance, validated_data):
        role = validated_data.get('role', instance.role)
        department = validated_data.get('department', instance.department)
        if role == 'faculty' and not department:
            raise serializers.ValidationError({"department": "Faculty users must be assigned to a department."})
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

    def default_classroom_permission(self, role):
        if role in ['admin', 'super_admin']:
            return 'manage_classrooms'
        if role == 'faculty':
            return 'class_session'
        return 'view_only'

class DepartmentSerializer(serializers.ModelSerializer):
    hod_name = serializers.CharField(source='hod.get_full_name', read_only=True)
    class Meta:
        model = Department
        fields = '__all__'

class ProgramSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = Program
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    class Meta:
        model = Semester
        fields = '__all__'

class SectionSerializer(serializers.ModelSerializer):
    semester_name = serializers.CharField(source='semester.__str__', read_only=True)
    class Meta:
        model = Section
        fields = '__all__'

class SubjectSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = Subject
        fields = '__all__'

class CurriculumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Curriculum
        fields = '__all__'

class FacultyAssignmentSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    section_name = serializers.CharField(source='section.__str__', read_only=True)
    class Meta:
        model = FacultyAssignment
        fields = '__all__'

class RoomSerializer(serializers.ModelSerializer):
    block = serializers.PrimaryKeyRelatedField(queryset=Block.objects.all(), required=False)
    block_code = serializers.CharField(source='block.code', read_only=True)
    block_name = serializers.CharField(source='block.name', read_only=True)

    class Meta:
        model = Room
        fields = '__all__'
        validators = []

    def validate(self, attrs):
        def canonical_block_name(value):
            raw = str(value or '').strip()
            normalized = raw.lower()
            aliases = {
                's': 'S-Block',
                's block': 'S-Block',
                's-block': 'S-Block',
                'p': 'P-Block',
                'p block': 'P-Block',
                'p-block': 'P-Block',
                'n': 'N-Block',
                'n block': 'N-Block',
                'n-block': 'N-Block',
                'e': 'E-Block',
                'e block': 'E-Block',
                'e-block': 'E-Block',
            }
            return aliases.get(normalized, raw or 'S-Block')

        building = canonical_block_name(attrs.get('building') or getattr(self.instance, 'building', None) or 'S-Block')
        block = attrs.get('block') or getattr(self.instance, 'block', None)
        if not block:
            block = Block.objects.filter(code__iexact=building).first()
            if not block:
                block = Block.objects.create(code=building, name=building)
            attrs['block'] = block
        attrs['building'] = block.name

        room_number = attrs.get('room_number') or getattr(self.instance, 'room_number', None)
        if room_number:
            existing = Room.objects.filter(block=block, room_number=room_number)
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError({
                    "detail": f"Classroom {room_number} already exists in {block.name}."
                })
        return attrs

class BookingSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    block_name = serializers.CharField(source='room.block.name', read_only=True)
    block_code = serializers.CharField(source='room.block.code', read_only=True)
    class Meta:
        model = Booking
        fields = '__all__'

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None
        room = attrs.get('room') or getattr(self.instance, 'room', None)
        start_time = attrs.get('start_time') or getattr(self.instance, 'start_time', None)
        end_time = attrs.get('end_time') or getattr(self.instance, 'end_time', None)

        if not start_time or not end_time:
            raise serializers.ValidationError({"detail": "Start time and end time are required."})
        if end_time <= start_time:
            raise serializers.ValidationError({"detail": "End time must be after start time."})
        if start_time < timezone.now():
            raise serializers.ValidationError({"detail": "Booking start time cannot be in the past."})

        overlaps = Booking.objects.filter(
            room=room,
            status='Approved',
            start_time__lt=end_time,
            end_time__gt=start_time
        )
        if self.instance:
            overlaps = overlaps.exclude(id=self.instance.id)
        if overlaps.exists():
            existing = overlaps.select_related('user').first()
            raise serializers.ValidationError({
                "detail": f"Classroom already booked by {existing.user.get_full_name()} for this time."
            })

        active_session = ClassSession.objects.filter(
            room=room,
            status='Active',
            start_time__lt=end_time
        ).filter(models.Q(end_time__isnull=True) | models.Q(end_time__gt=start_time)).first()
        if active_session:
            raise serializers.ValidationError({
                "detail": f"Classroom is occupied by {active_session.faculty.get_full_name()} during this time."
            })

        if user and user.is_authenticated and not attrs.get('user'):
            attrs['user'] = user
        return attrs

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    class Meta:
        model = AuditLog
        fields = '__all__'

class ClassSessionSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    faculty_name = serializers.CharField(source='faculty.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    semester_name = serializers.CharField(source='section.semester.__str__', read_only=True)
    department_name = serializers.CharField(source='faculty.department.name', read_only=True)

    class Meta:
        model = ClassSession
        fields = '__all__'
