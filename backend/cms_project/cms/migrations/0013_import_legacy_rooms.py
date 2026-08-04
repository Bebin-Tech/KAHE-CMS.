from django.db import migrations


BLOCK_ALIASES = {
    's block': 'S-Block',
    's-block': 'S-Block',
    's': 'S-Block',
    'p block': 'P-Block',
    'p-block': 'P-Block',
    'p': 'P-Block',
    'n block': 'N-Block',
    'n-block': 'N-Block',
    'n': 'N-Block',
    'e block': 'E-Block',
    'e-block': 'E-Block',
    'e': 'E-Block',
}


def normalize_block(value, room_number):
    raw = str(value or '').strip()
    key = raw.lower()
    if key in BLOCK_ALIASES:
        return BLOCK_ALIASES[key]

    prefix = str(room_number or '').strip()[:1].lower()
    if prefix in BLOCK_ALIASES:
        return BLOCK_ALIASES[prefix]

    return raw or 'S-Block'


def normalize_room_type(value):
    raw = str(value or '').strip().lower()
    if raw == 'lab':
        return 'Lab'
    if raw in ['seminar hall', 'seminar']:
        return 'Seminar Hall'
    return 'Classroom'


def normalize_status(value):
    raw = str(value or '').strip().lower()
    if raw in ['occupied', 'non-available', 'non_available', 'unavailable']:
        return 'Occupied'
    if raw == 'booked':
        return 'Booked'
    return 'Available'


def import_legacy_rooms(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        existing_table = connection.introspection.table_names(cursor)
        if 'rooms' not in existing_table:
            return

        Block = apps.get_model('cms', 'Block')
        Room = apps.get_model('cms', 'Room')

        cursor.execute(
            """
            SELECT room_number, type, capacity, status, building, is_deleted
            FROM rooms
            WHERE room_number IS NOT NULL
            """
        )
        legacy_rooms = cursor.fetchall()

    for room_number, room_type, capacity, status, building, is_deleted in legacy_rooms:
        if is_deleted:
            continue

        clean_room_number = str(room_number or '').strip()
        if not clean_room_number:
            continue

        block_name = normalize_block(building, clean_room_number)
        block, _ = Block.objects.get_or_create(code=block_name, defaults={'name': block_name})

        if Room.objects.filter(block=block, room_number=clean_room_number).exists():
            continue

        Room.objects.create(
            room_number=clean_room_number,
            block=block,
            building=block.name,
            capacity=capacity or 60,
            type=normalize_room_type(room_type),
            status=normalize_status(status),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0012_user_scalability_indexes'),
    ]

    operations = [
        migrations.RunPython(import_legacy_rooms, migrations.RunPython.noop),
    ]
