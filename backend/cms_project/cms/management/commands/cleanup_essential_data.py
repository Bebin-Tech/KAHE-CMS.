from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from cms.models import (
    AuditLog,
    Block,
    Booking,
    ClassSession,
    Curriculum,
    Department,
    FacultyAssignment,
    PeriodTiming,
    Program,
    Room,
    Section,
    Semester,
    Subject,
    Timetable,
    TimetableSetting,
    User,
)


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


class Command(BaseCommand):
    help = (
        'Remove nonessential KAHE CMS data while preserving users, departments, '
        'blocks, classrooms, active sessions, and upcoming bookings.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned without changing the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        actions = defaultdict(int)
        now = timezone.now()

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run only. No data will be changed.'))
            self.collect_counts(now, actions)
            for key in sorted(actions):
                self.stdout.write(f'{key}: {actions[key]}')
            self.stdout.write(self.style.SUCCESS('Dry run complete.'))
            return

        with transaction.atomic():
            self.complete_expired_sessions(now, actions)
            self.drop_legacy_tables(actions)

            actions['audit_logs_deleted'] += AuditLog.objects.count()
            AuditLog.objects.all().delete()

            cleanup_models = [
                Timetable,
                TimetableSetting,
                PeriodTiming,
                FacultyAssignment,
                Curriculum,
                Section,
                Semester,
                Program,
            ]
            for model in cleanup_models:
                count = model.objects.count()
                model.objects.all().delete()
                actions[f'{model._meta.model_name}_deleted'] += count

            past_bookings = Booking.objects.filter(end_time__lt=now)
            actions['past_bookings_deleted'] += past_bookings.count()
            past_bookings.delete()

            completed_sessions = ClassSession.objects.exclude(status='Active')
            actions['completed_sessions_deleted'] += completed_sessions.count()
            completed_sessions.delete()

            self.merge_duplicate_departments(actions)
            self.remove_empty_blocks(actions)
            self.normalize_room_status(actions)

        for key in sorted(actions):
            self.stdout.write(f'{key}: {actions[key]}')

        if dry_run:
            self.stdout.write(self.style.SUCCESS('Dry run complete.'))
        else:
            self.stdout.write(self.style.SUCCESS('Database cleanup complete.'))

    def collect_counts(self, now, actions):
        with connection.cursor() as cursor:
            existing_tables = set(connection.introspection.table_names(cursor))
        actions['legacy_tables_to_drop'] = sum(1 for table in LEGACY_TABLES if table in existing_tables)
        actions['expired_sessions_to_complete'] = ClassSession.objects.filter(
            status='Active',
            end_time__isnull=False,
            end_time__lte=now,
        ).count()
        actions['audit_logs_to_delete'] = AuditLog.objects.count()
        for model in [Timetable, TimetableSetting, PeriodTiming, FacultyAssignment, Curriculum, Section, Semester, Program]:
            actions[f'{model._meta.model_name}_to_delete'] = model.objects.count()
        actions['past_bookings_to_delete'] = Booking.objects.filter(end_time__lt=now).count()
        actions['completed_sessions_to_delete'] = ClassSession.objects.exclude(status='Active').count()
        actions['duplicate_departments_to_merge'] = self.count_duplicate_departments()
        actions['empty_blocks_to_delete'] = Block.objects.exclude(code__in=CORE_BLOCKS).filter(rooms__isnull=True).count()
        active_room_ids = ClassSession.objects.filter(status='Active').values('room_id')
        actions['stale_room_statuses_to_fix'] = Room.objects.exclude(id__in=active_room_ids).exclude(status='Available').count()

    def drop_legacy_tables(self, actions):
        with connection.cursor() as cursor:
            existing_tables = set(connection.introspection.table_names(cursor))
            for table in LEGACY_TABLES:
                if table not in existing_tables:
                    continue
                cursor.execute(f'DROP TABLE {connection.ops.quote_name(table)}')
                actions['legacy_tables_dropped'] += 1

    def complete_expired_sessions(self, now, actions):
        expired_sessions = ClassSession.objects.filter(
            status='Active',
            end_time__isnull=False,
            end_time__lte=now,
        )
        room_ids = list(expired_sessions.values_list('room_id', flat=True))
        actions['expired_sessions_completed'] += expired_sessions.count()
        expired_sessions.update(status='Completed')
        if room_ids:
            Room.objects.filter(id__in=room_ids, status='Occupied').update(status='Available')

    def merge_duplicate_departments(self, actions):
        groups = defaultdict(list)
        for department in Department.objects.order_by('id'):
            key = ((department.code or '').strip().lower(), (department.name or '').strip().lower())
            if key[0] or key[1]:
                groups[key].append(department)

        for departments in groups.values():
            keeper = departments[0]
            for duplicate in departments[1:]:
                if not keeper.hod_id and duplicate.hod_id:
                    keeper.hod = duplicate.hod
                    keeper.save(update_fields=['hod'])
                User.objects.filter(department=duplicate).update(department=keeper)
                Subject.objects.filter(department=duplicate).update(department=keeper)
                duplicate.delete()
                actions['duplicate_departments_merged'] += 1

    def count_duplicate_departments(self):
        groups = defaultdict(int)
        duplicate_count = 0
        for department in Department.objects.order_by('id'):
            key = ((department.code or '').strip().lower(), (department.name or '').strip().lower())
            if not key[0] and not key[1]:
                continue
            groups[key] += 1
            if groups[key] > 1:
                duplicate_count += 1
        return duplicate_count

    def remove_empty_blocks(self, actions):
        empty_blocks = Block.objects.exclude(code__in=CORE_BLOCKS).filter(rooms__isnull=True)
        actions['empty_blocks_deleted'] += empty_blocks.count()
        empty_blocks.delete()

    def normalize_room_status(self, actions):
        active_room_ids = ClassSession.objects.filter(status='Active').values('room_id')
        stale_rooms = Room.objects.exclude(id__in=active_room_ids).exclude(status='Available')
        actions['stale_room_statuses_fixed'] += stale_rooms.count()
        stale_rooms.update(status='Available')
