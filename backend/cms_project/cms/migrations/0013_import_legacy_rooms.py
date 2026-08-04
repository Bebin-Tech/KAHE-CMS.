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
    # Legacy room imports are intentionally disabled. The current system should
    # preserve only classrooms created in the normalized cms_room table.
    return


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0012_user_scalability_indexes'),
    ]

    operations = [
        migrations.RunPython(import_legacy_rooms, migrations.RunPython.noop),
    ]
