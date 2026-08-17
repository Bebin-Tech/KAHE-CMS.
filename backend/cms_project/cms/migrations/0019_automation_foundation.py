from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def clean_duplicate_timetable_slots(apps, schema_editor):
    Timetable = apps.get_model('cms', 'Timetable')

    def delete_duplicate_groups(fields):
        groups = (
            Timetable.objects.values(*fields)
            .annotate(total=models.Count('id'), keep_id=models.Min('id'))
            .filter(total__gt=1)
        )
        for group in groups:
            filters = {field: group[field] for field in fields}
            Timetable.objects.filter(**filters).exclude(id=group['keep_id']).delete()

    delete_duplicate_groups(['day', 'period_id', 'section_id'])
    delete_duplicate_groups(['day', 'period_id', 'faculty_id'])
    delete_duplicate_groups(['day', 'period_id', 'room_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0018_keep_only_essential_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='section',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='students',
                to='cms.section',
            ),
        ),
        migrations.AddField(
            model_name='section',
            name='tutor',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'role': 'faculty'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tutored_sections',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='AutomationRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('weekly', 'Weekly'), ('monthly', 'Monthly'), ('custom', 'Custom')], default='weekly', max_length=20)),
                ('status', models.CharField(choices=[('Completed', 'Completed'), ('Partial', 'Partial'), ('Failed', 'Failed')], default='Completed', max_length=20)),
                ('generated_timetables', models.IntegerField(default=0)),
                ('generated_notifications', models.IntegerField(default=0)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('triggered_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='automation_runs', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='FacultyAvailability',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('day', models.CharField(choices=[('Monday', 'Monday'), ('Tuesday', 'Tuesday'), ('Wednesday', 'Wednesday'), ('Thursday', 'Thursday'), ('Friday', 'Friday'), ('Saturday', 'Saturday')], max_length=20)),
                ('is_available', models.BooleanField(default=True)),
                ('faculty', models.ForeignKey(limit_choices_to={'role': 'faculty'}, on_delete=django.db.models.deletion.CASCADE, related_name='availability_slots', to=settings.AUTH_USER_MODEL)),
                ('period', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='cms.periodtiming')),
            ],
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=160)),
                ('message', models.TextField()),
                ('data', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='SectionRoomAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='room_assignments_created', to=settings.AUTH_USER_MODEL)),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='section_home_assignments', to='cms.room')),
                ('section', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='home_room_assignment', to='cms.section')),
            ],
        ),
        migrations.AddConstraint(
            model_name='facultyavailability',
            constraint=models.UniqueConstraint(fields=('faculty', 'day', 'period'), name='unique_faculty_day_period_availability'),
        ),
        migrations.AddIndex(
            model_name='facultyavailability',
            index=models.Index(fields=['faculty', 'day', 'is_available'], name='faculty_day_available_idx'),
        ),
        migrations.AddIndex(
            model_name='sectionroomassignment',
            index=models.Index(fields=['room'], name='section_home_room_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read', '-created_at'], name='notification_user_read_idx'),
        ),
        migrations.AddIndex(
            model_name='automationrun',
            index=models.Index(fields=['-created_at'], name='automation_run_created_idx'),
        ),
        migrations.RunPython(clean_duplicate_timetable_slots, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='timetable',
            constraint=models.UniqueConstraint(fields=('day', 'period', 'section'), name='unique_section_day_period'),
        ),
        migrations.AddConstraint(
            model_name='timetable',
            constraint=models.UniqueConstraint(fields=('day', 'period', 'faculty'), name='unique_faculty_day_period'),
        ),
        migrations.AddConstraint(
            model_name='timetable',
            constraint=models.UniqueConstraint(fields=('day', 'period', 'room'), name='unique_room_day_period'),
        ),
        migrations.AddIndex(
            model_name='timetable',
            index=models.Index(fields=['day', 'period'], name='timetable_day_period_idx'),
        ),
        migrations.AddIndex(
            model_name='timetable',
            index=models.Index(fields=['section', 'day'], name='timetable_section_day_idx'),
        ),
        migrations.AddIndex(
            model_name='timetable',
            index=models.Index(fields=['faculty', 'day'], name='timetable_faculty_day_idx'),
        ),
    ]
