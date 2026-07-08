from django.db import migrations, models
import django.db.models.deletion


BLOCKS = [
    ('S-Block', 'S-Block'),
    ('P-Block', 'P-Block'),
    ('N-Block', 'N-Block'),
    ('E-Block', 'E-Block'),
]


def seed_blocks(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')

    for code, name in BLOCKS:
        Block.objects.get_or_create(code=code, defaults={'name': name})

    for room in Room.objects.all():
        block_name = room.building or 'S-Block'
        block, _ = Block.objects.get_or_create(code=block_name, defaults={'name': block_name})
        room.block = block
        room.building = block.name
        room.save(update_fields=['block', 'building'])


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0003_room_block_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='Block',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=20, unique=True)),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.AddField(
            model_name='room',
            name='block',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='rooms', to='cms.block'),
        ),
        migrations.RunPython(seed_blocks, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='room',
            unique_together={('block', 'room_number')},
        ),
    ]
