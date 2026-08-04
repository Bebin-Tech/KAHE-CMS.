from django.db import migrations


def add_t_block(apps, schema_editor):
    Block = apps.get_model('cms', 'Block')
    block, _ = Block.objects.get_or_create(code='T-Block', defaults={'name': 'T-Block'})
    if block.name != 'T-Block':
        block.name = 'T-Block'
        block.save(update_fields=['name'])


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0016_reset_s_block_classrooms'),
    ]

    operations = [
        migrations.RunPython(add_t_block, migrations.RunPython.noop),
    ]
