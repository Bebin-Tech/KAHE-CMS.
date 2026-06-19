from rest_framework import serializers
from .models import User, Department, Program, Semester, Section, Subject, FacultyAssignment, Room, TimetableEntry, TimetableSettings

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'faculty_id', 'phone', 'department', 'designation', 'max_hours_per_week', 'availability_status')

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = '__all__'

class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = '__all__'

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'

class FacultyAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacultyAssignment
        fields = '__all__'

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'

class TimetableEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableEntry
        fields = '__all__'

class TimetableSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableSettings
        fields = '__all__'
