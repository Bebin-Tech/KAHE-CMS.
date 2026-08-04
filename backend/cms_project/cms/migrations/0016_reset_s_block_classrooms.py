from django.db import migrations


LABS = ['103', '104', 'S3', 'S4', 'S5', 'S6']

CLASSROOMS = [
    '107', '108', '109', '110',
    '207', '208', '209', '210', '211',
    '301', '302', '303', '304', '305', '307', '309', '310', '311',
    '401', '402', '403', '404', '405', '407', '408', '409', '411', '412', '413',
]


def reset_s_block_classrooms(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')
    Booking = apps.get_model('cms', 'Booking')
    ClassSession = apps.get_model('cms', 'ClassSession')
    Timetable = apps.get_model('cms', 'Timetable')

    Booking.objects.all().delete()
    ClassSession.objects.all().delete()
    Timetable.objects.all().delete()
    Room.objects.all().delete()

    block, _ = Block.objects.get_or_create(code='S-Block', defaults={'name': 'S-Block'})
    if block.name != 'S-Block':
        block.name = 'S-Block'
        block.save(update_fields=['name'])

    Room.objects.bulk_create([
        Room(
            room_number=room_number,
            block=block,
            building='S-Block',
            capacity=60,
            type='Lab',
            status='Available',
        )
        for room_number in LABS
    ] + [
        Room(
            room_number=room_number,
            block=block,
            building='S-Block',
            capacity=60,
            type='Classroom',
            status='Available',
        )
        for room_number in CLASSROOMS
    ])

    Block.objects.exclude(code__in=['S-Block', 'P-Block', 'N-Block', 'E-Block']).filter(rooms__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0015_cleanup_nonessential_database_data'),
    ]

    operations = [
        migrations.RunPython(reset_s_block_classrooms, migrations.RunPython.noop),
    ]
