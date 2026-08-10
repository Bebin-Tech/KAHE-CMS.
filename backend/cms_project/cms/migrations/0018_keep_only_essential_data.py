from collections import defaultdict

from django.db import migrations
from django.utils import timezone


LEGACY_TABLES = [
    'academic_settings',
    'approval_workflows',
    'audit_logs',
    'bookings',
    'class_sessions',
    'conflicts',
    'curricula',
    'departments',
    'faculty_assignments',
    'faculty_leaves',
    'faculty_workload',
    'holidays',
    'notifications',
    'period_timings',
    'programs',
    'rooms',
    'schedules',
    'sections',
    'semesters',
    'subjects',
    'substitutions',
    'timetable_settings',
    'timetables',
    'users',
    'working_days',
]

CORE_BLOCKS = ['S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block']


def cleanup_essential_data(apps, schema_editor):
    connection = schema_editor.connection
    now = timezone.now()

    User = apps.get_model('cms', 'User')
    Department = apps.get_model('cms', 'Department')
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')
    Subject = apps.get_model('cms', 'Subject')
    Program = apps.get_model('cms', 'Program')
    Semester = apps.get_model('cms', 'Semester')
    Section = apps.get_model('cms', 'Section')
    Curriculum = apps.get_model('cms', 'Curriculum')
    FacultyAssignment = apps.get_model('cms', 'FacultyAssignment')
    Timetable = apps.get_model('cms', 'Timetable')
    TimetableSetting = apps.get_model('cms', 'TimetableSetting')
    PeriodTiming = apps.get_model('cms', 'PeriodTiming')
    ClassSession = apps.get_model('cms', 'ClassSession')
    Booking = apps.get_model('cms', 'Booking')
    AuditLog = apps.get_model('cms', 'AuditLog')

    expired_sessions = ClassSession.objects.filter(
        status='Active',
        end_time__isnull=False,
        end_time__lte=now,
    )
    expired_room_ids = list(expired_sessions.values_list('room_id', flat=True))
    expired_sessions.update(status='Completed')
    if expired_room_ids:
        Room.objects.filter(id__in=expired_room_ids, status='Occupied').update(status='Available')

    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names(cursor))
        for table in LEGACY_TABLES:
            if table in existing_tables:
                cursor.execute(f'DROP TABLE {connection.ops.quote_name(table)}')

    AuditLog.objects.all().delete()
    Timetable.objects.all().delete()
    TimetableSetting.objects.all().delete()
    PeriodTiming.objects.all().delete()
    FacultyAssignment.objects.all().delete()
    Curriculum.objects.all().delete()
    Section.objects.all().delete()
    Semester.objects.all().delete()
    Program.objects.all().delete()

    Booking.objects.filter(end_time__lt=now).delete()
    ClassSession.objects.exclude(status='Active').delete()

    active_subject_ids = ClassSession.objects.filter(status='Active').values('subject_id')
    Subject.objects.exclude(id__in=active_subject_ids).delete()

    department_groups = defaultdict(list)
    for department in Department.objects.order_by('id'):
        key = ((department.code or '').strip().lower(), (department.name or '').strip().lower())
        if key[0] or key[1]:
            department_groups[key].append(department)

    for departments in department_groups.values():
        keeper = departments[0]
        for duplicate in departments[1:]:
            if not keeper.hod_id and duplicate.hod_id:
                keeper.hod_id = duplicate.hod_id
                keeper.save(update_fields=['hod'])
            User.objects.filter(department_id=duplicate.id).update(department_id=keeper.id)
            Subject.objects.filter(department_id=duplicate.id).update(department_id=keeper.id)
            duplicate.delete()

    Block.objects.exclude(code__in=CORE_BLOCKS).filter(rooms__isnull=True).delete()

    active_room_ids = ClassSession.objects.filter(status='Active').values('room_id')
    Room.objects.exclude(id__in=active_room_ids).exclude(status='Available').update(status='Available')


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0017_add_t_block'),
    ]

    operations = [
        migrations.RunPython(cleanup_essential_data, migrations.RunPython.noop),
    ]
