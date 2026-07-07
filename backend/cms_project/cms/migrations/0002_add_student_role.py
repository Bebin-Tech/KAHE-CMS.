from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('super_admin', 'Super Admin'),
                    ('admin', 'Admin'),
                    ('hod', 'HOD'),
                    ('faculty', 'Faculty'),
                    ('student', 'Student'),
                    ('staff', 'Staff'),
                ],
                default='staff',
                max_length=20,
            ),
        ),
    ]
