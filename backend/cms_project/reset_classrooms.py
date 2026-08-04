import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DATABASE_PATH = ROOT_DIR / 'kahe_cms.db'

ROOMS_BY_BLOCK = {
    'S-Block': {
        'labs': ['103', '104', 'S3', 'S4', 'S5', 'S6'],
        'classrooms': [
            '107', '108', '109', '110',
            '207', '208', '209', '210', '211',
            '301', '302', '303', '304', '305', '307', '309', '310', '311',
            '401', '402', '403', '404', '405', '407', '408', '409', '411', '412', '413',
        ],
    },
    'P-Block': {
        'labs': ['203'],
        'classrooms': ['105', '107', '108', '201', '202', '204', '205', '401', '404', '405'],
    },
    'T-Block': {
        'labs': [],
        'classrooms': ['201', '203', '204', '205', '301', '303'],
    },
}

DEFAULT_BLOCKS = ['S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block']


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

    for default_block in DEFAULT_BLOCKS:
        cursor.execute(
            'SELECT id FROM "cms_block" WHERE code=? OR name=? ORDER BY id LIMIT 1',
            (default_block, default_block),
        )
        row = cursor.fetchone()
        if row:
            cursor.execute(
                'UPDATE "cms_block" SET code=?, name=? WHERE id=?',
                (default_block, default_block, row[0]),
            )
        else:
            cursor.execute(
                'INSERT INTO "cms_block" (code, name) VALUES (?, ?)',
                (default_block, default_block),
            )

    totals = {}
    for block_name, room_groups in ROOMS_BY_BLOCK.items():
        cursor.execute(
            'SELECT id FROM "cms_block" WHERE code=? OR name=? ORDER BY id LIMIT 1',
            (block_name, block_name),
        )
        row = cursor.fetchone()
        if row:
            block_id = row[0]
            cursor.execute(
                'UPDATE "cms_block" SET code=?, name=? WHERE id=?',
                (block_name, block_name, block_id),
            )
        else:
            cursor.execute(
                'INSERT INTO "cms_block" (code, name) VALUES (?, ?)',
                (block_name, block_name),
            )
            block_id = cursor.lastrowid

        for room_number in room_groups['labs']:
            cursor.execute(
                """
                INSERT INTO "cms_room" (room_number, building, capacity, type, status, block_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (room_number, block_name, 60, 'Lab', 'Available', block_id),
            )

        for room_number in room_groups['classrooms']:
            cursor.execute(
                """
                INSERT INTO "cms_room" (room_number, building, capacity, type, status, block_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (room_number, block_name, 60, 'Classroom', 'Available', block_id),
            )

        totals[block_name] = len(room_groups['labs']) + len(room_groups['classrooms'])

    cursor.execute(
        """
        DELETE FROM "cms_block"
        WHERE id NOT IN (SELECT DISTINCT block_id FROM "cms_room")
        AND code NOT IN ('S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block')
        """
    )

    connection.commit()
    total = sum(totals.values())
    print(f'Recreated {total} rooms.')
    for block_name, room_groups in ROOMS_BY_BLOCK.items():
        print(f'{block_name}: {totals[block_name]} rooms')
        print(f'  Labs: {", ".join(room_groups["labs"])}')
        print(f'  Classrooms: {", ".join(room_groups["classrooms"])}')


if __name__ == '__main__':
    main()
