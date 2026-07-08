from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0005_repair_room_constraints'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='room',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='semester',
            constraint=models.UniqueConstraint(fields=('program', 'number'), name='unique_semester_per_program'),
        ),
        migrations.AddConstraint(
            model_name='curriculum',
            constraint=models.UniqueConstraint(
                fields=('department', 'program', 'semester', 'subject'),
                name='unique_curriculum_entry',
            ),
        ),
        migrations.AddConstraint(
            model_name='room',
            constraint=models.UniqueConstraint(fields=('block', 'room_number'), name='unique_room_per_block'),
        ),
        migrations.AddIndex(
            model_name='room',
            index=models.Index(fields=['block', 'room_number'], name='room_block_number_idx'),
        ),
        migrations.AddIndex(
            model_name='room',
            index=models.Index(fields=['status'], name='room_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='periodtiming',
            constraint=models.UniqueConstraint(fields=('period_number',), name='unique_period_number'),
        ),
        migrations.AddConstraint(
            model_name='classsession',
            constraint=models.UniqueConstraint(
                condition=models.Q(status='Active'),
                fields=('room',),
                name='unique_active_session_per_room',
            ),
        ),
        migrations.AddIndex(
            model_name='classsession',
            index=models.Index(fields=['room', 'status'], name='session_room_status_idx'),
        ),
        migrations.AddIndex(
            model_name='classsession',
            index=models.Index(fields=['faculty', 'status'], name='session_faculty_status_idx'),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['room', 'start_time', 'end_time'], name='booking_room_time_idx'),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['user', 'status'], name='booking_user_status_idx'),
        ),
    ]
