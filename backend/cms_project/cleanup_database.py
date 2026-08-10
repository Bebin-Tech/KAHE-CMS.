import os
import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DATABASE_PATH = Path(os.environ.get('SQLITE_DATABASE_PATH') or ROOT_DIR / 'kahe_cms.db')

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

NONESSENTIAL_CMS_TABLES = [
    'cms_timetable',
    'cms_timetablesetting',
    'cms_periodtiming',
    'cms_facultyassignment',
    'cms_curriculum',
    'cms_section',
    'cms_semester',
    'cms_program',
]


def table_exists(cursor, table_name):
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
        (table_name,),
    )
    return cursor.fetchone() is not None


def main():
    if not DATABASE_PATH.exists():
        raise SystemExit(f'Database not found: {DATABASE_PATH}')

    connection = sqlite3.connect(DATABASE_PATH)
    cursor = connection.cursor()

    dropped = []
    cleared = []

    for table in LEGACY_TABLES:
        if table_exists(cursor, table):
            cursor.execute(f'DROP TABLE "{table}"')
            dropped.append(table)

    for table in NONESSENTIAL_CMS_TABLES:
        if table_exists(cursor, table):
            cursor.execute(f'DELETE FROM "{table}"')
            cleared.append(table)

    cursor.execute(
        """
        DELETE FROM cms_block
        WHERE id NOT IN (SELECT DISTINCT block_id FROM cms_room)
        AND code NOT IN ('S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block')
        """
    )

    connection.commit()
    connection.close()

    print(f'Cleaned database: {DATABASE_PATH}')
    print(f'Dropped legacy tables: {len(dropped)}')
    if dropped:
        print(', '.join(dropped))
    print(f'Cleared nonessential cms tables: {len(cleared)}')
    if cleared:
        print(', '.join(cleared))


if __name__ == '__main__':
    main()
