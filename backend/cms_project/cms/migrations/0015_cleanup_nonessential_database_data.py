from django.db import migrations


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


def cleanup_nonessential_data(apps, schema_editor):
    connection = schema_editor.connection

    # Remove old standalone tables from earlier app versions. The live app uses
    # normalized cms_* tables for users, departments, blocks, rooms, bookings,
    # sessions, and audit records.
    with connection.cursor() as cursor:
        for table in LEGACY_TABLES:
            cursor.execute(f'DROP TABLE IF EXISTS "{table}"')

    Timetable = apps.get_model('cms', 'Timetable')
    TimetableSetting = apps.get_model('cms', 'TimetableSetting')
    PeriodTiming = apps.get_model('cms', 'PeriodTiming')
    Curriculum = apps.get_model('cms', 'Curriculum')
    FacultyAssignment = apps.get_model('cms', 'FacultyAssignment')
    Program = apps.get_model('cms', 'Program')
    Semester = apps.get_model('cms', 'Semester')
    Section = apps.get_model('cms', 'Section')
    Subject = apps.get_model('cms', 'Subject')
    ClassSession = apps.get_model('cms', 'ClassSession')
    Block = apps.get_model('cms', 'Block')

    Timetable.objects.all().delete()
    TimetableSetting.objects.all().delete()
    PeriodTiming.objects.all().delete()
    FacultyAssignment.objects.all().delete()
    Curriculum.objects.all().delete()
    Section.objects.all().delete()
    Semester.objects.all().delete()
    Program.objects.all().delete()
    Subject.objects.exclude(
        id__in=ClassSession.objects.exclude(subject_id=None).values('subject_id')
    ).delete()
    Block.objects.exclude(
        code__in=['S-Block', 'P-Block', 'N-Block', 'E-Block']
    ).filter(rooms__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0014_normalize_room_block_aliases'),
    ]

    operations = [
        migrations.RunPython(cleanup_nonessential_data, migrations.RunPython.noop),
    ]
