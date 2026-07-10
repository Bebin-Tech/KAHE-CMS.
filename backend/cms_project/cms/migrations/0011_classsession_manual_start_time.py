from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0010_assign_existing_faculty_department'),
    ]

    operations = [
        migrations.AlterField(
            model_name='classsession',
            name='start_time',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
