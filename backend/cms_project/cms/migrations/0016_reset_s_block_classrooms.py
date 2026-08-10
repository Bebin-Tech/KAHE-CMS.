from django.db import migrations


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


def reset_s_block_classrooms(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')

    for block_name in ['S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block']:
        block, _ = Block.objects.get_or_create(code=block_name, defaults={'name': block_name})
        if block.name != block_name:
            block.name = block_name
            block.save(update_fields=['name'])

    if Room.objects.exists():
        return

    rooms = []
    for block_name, room_groups in ROOMS_BY_BLOCK.items():
        block, _ = Block.objects.get_or_create(code=block_name, defaults={'name': block_name})
        if block.name != block_name:
            block.name = block_name
            block.save(update_fields=['name'])

        for room_number in room_groups['labs']:
            if not Room.objects.filter(block=block, room_number=room_number).exists():
                rooms.append(Room(
                    room_number=room_number,
                    block=block,
                    building=block_name,
                    capacity=60,
                    type='Lab',
                    status='Available',
                ))
        for room_number in room_groups['classrooms']:
            if not Room.objects.filter(block=block, room_number=room_number).exists():
                rooms.append(Room(
                    room_number=room_number,
                    block=block,
                    building=block_name,
                    capacity=60,
                    type='Classroom',
                    status='Available',
                ))

    if rooms:
        Room.objects.bulk_create(rooms)


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0015_cleanup_nonessential_database_data'),
    ]

    operations = [
        migrations.RunPython(reset_s_block_classrooms, migrations.RunPython.noop),
    ]
