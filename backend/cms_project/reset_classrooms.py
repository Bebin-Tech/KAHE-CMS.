import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DATABASE_PATH = ROOT_DIR / 'kahe_cms.db'

LABS = ['103', '104', 'S3', 'S4', 'S5', 'S6']

CLASSROOMS = [
    '107', '108', '109', '110',
    '207', '208', '209', '210', '211',
    '301', '302', '303', '304', '305', '307', '309', '310', '311',
    '401', '402', '403', '404', '405', '407', '408', '409', '411', '412', '413',
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

    for table in ['cms_booking', 'cms_classsession', 'cms_timetable']:
        if table_exists(cursor, table):
            cursor.execute(f'DELETE FROM "{table}"')

    cursor.execute('DELETE FROM "cms_room"')

    cursor.execute(
        'SELECT id FROM "cms_block" WHERE code=? OR name=? ORDER BY id LIMIT 1',
        ('S-Block', 'S-Block'),
    )
    row = cursor.fetchone()
    if row:
        block_id = row[0]
        cursor.execute(
            'UPDATE "cms_block" SET code=?, name=? WHERE id=?',
            ('S-Block', 'S-Block', block_id),
        )
    else:
        cursor.execute(
            'INSERT INTO "cms_block" (code, name) VALUES (?, ?)',
            ('S-Block', 'S-Block'),
        )
        block_id = cursor.lastrowid

    for room_number in LABS:
        cursor.execute(
            """
            INSERT INTO "cms_room" (room_number, building, capacity, type, status, block_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (room_number, 'S-Block', 60, 'Lab', 'Available', block_id),
        )

    for room_number in CLASSROOMS:
        cursor.execute(
            """
            INSERT INTO "cms_room" (room_number, building, capacity, type, status, block_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (room_number, 'S-Block', 60, 'Classroom', 'Available', block_id),
        )

    cursor.execute(
        """
        DELETE FROM "cms_block"
        WHERE id NOT IN (SELECT DISTINCT block_id FROM "cms_room")
        AND code NOT IN ('S-Block', 'P-Block', 'N-Block', 'E-Block')
        """
    )

    connection.commit()
    total = len(LABS) + len(CLASSROOMS)
    print(f'Recreated {total} S-Block classrooms.')
    print(f'Labs: {", ".join(LABS)}')
    print(f'Classrooms: {", ".join(CLASSROOMS)}')


if __name__ == '__main__':
    main()
