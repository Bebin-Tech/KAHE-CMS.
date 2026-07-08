import django.db.models.deletion
from django.db import migrations, models


def merge_duplicate_sections(apps, schema_editor):
    Section = apps.get_model('cms', 'Section')
    FacultyAssignment = apps.get_model('cms', 'FacultyAssignment')
    Timetable = apps.get_model('cms', 'Timetable')
    ClassSession = apps.get_model('cms', 'ClassSession')

    duplicates = (
        Section.objects.values('semester_id', 'name')
        .annotate(count=models.Count('id'), keep_id=models.Min('id'))
        .filter(count__gt=1)
    )
    for duplicate in duplicates:
        sections = Section.objects.filter(
            semester_id=duplicate['semester_id'],
            name=duplicate['name'],
        ).exclude(id=duplicate['keep_id'])

        for section in sections:
            FacultyAssignment.objects.filter(section_id=section.id).update(section_id=duplicate['keep_id'])
            Timetable.objects.filter(section_id=section.id).update(section_id=duplicate['keep_id'])
            ClassSession.objects.filter(section_id=section.id).update(section_id=duplicate['keep_id'])
            section.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0006_database_integrity_constraints'),
    ]

    operations = [
        migrations.AddField(
            model_name='classsession',
            name='section',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to='cms.section',
            ),
        ),
        migrations.AddField(
            model_name='classsession',
            name='topic',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='classsession',
            name='remarks',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.RunPython(merge_duplicate_sections, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='section',
            constraint=models.UniqueConstraint(fields=('semester', 'name'), name='unique_section_per_semester'),
        ),
    ]
