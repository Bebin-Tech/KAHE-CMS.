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
            'max_hours_per_day', 'max_hours_per_week', 'availability_status'
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
    class Meta:
        model = Room
        fields = '__all__'

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
