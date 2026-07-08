import django.db.models.deletion
from django.db import migrations, models


def assign_default_room_block(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    Room = apps.get_model('cms', 'Room')
    block, _ = Block.objects.get_or_create(code='S-Block', defaults={'name': 'S-Block'})
    Room.objects.filter(block__isnull=True).update(block=block, building=block.name)


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0007_session_fields_and_section_constraint'),
    ]

    operations = [
        migrations.RunPython(assign_default_room_block, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='room',
            name='block',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='rooms',
                to='cms.block',
            ),
        ),
    ]
