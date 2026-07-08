from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0002_add_student_role'),
        ('cms', '0002_subject_allotted_hours_subject_mne_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='room',
            name='room_number',
            field=models.CharField(max_length=20),
        ),
        migrations.AlterUniqueTogether(
            name='room',
            unique_together={('building', 'room_number')},
        ),
    ]
