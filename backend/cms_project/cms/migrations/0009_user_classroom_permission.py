from django.db import migrations, models


def seed_classroom_permissions(apps, schema_editor):
    User = apps.get_model('cms', 'User')
    User.objects.filter(role__in=['admin', 'super_admin']).update(classroom_permission='manage_classrooms')
    User.objects.filter(role='faculty').update(classroom_permission='class_session')
    User.objects.filter(role='student').update(classroom_permission='view_only')


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0008_require_room_block'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='classroom_permission',
            field=models.CharField(
                choices=[
                    ('view_only', 'View Only'),
                    ('class_session', 'Start / End Class'),
                    ('manage_classrooms', 'Create / Edit / Delete Classrooms'),
                ],
                default='view_only',
                max_length=30,
            ),
        ),
        migrations.RunPython(seed_classroom_permissions, migrations.RunPython.noop),
    ]
