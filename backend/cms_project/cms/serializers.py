from rest_framework import serializers
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
            'date_joined'
        )
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'username': {'required': True}
        }

    def create(self, validated_data):
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
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

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
        building = str(attrs.get('building') or getattr(self.instance, 'building', None) or 'S-Block').strip()
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
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    class Meta:
        model = Booking
        fields = '__all__'

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
