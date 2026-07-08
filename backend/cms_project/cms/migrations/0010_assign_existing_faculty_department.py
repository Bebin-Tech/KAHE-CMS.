from django.db import migrations


def assign_existing_faculty_department(apps, schema_editor):
    Department = apps.get_model('cms', 'Department')
    User = apps.get_model('cms', 'User')

    department = Department.objects.filter(status='Active').order_by('id').first()
    if not department:
        department = Department.objects.order_by('id').first()
    if not department:
        return

    User.objects.filter(role='faculty', department__isnull=True).update(department=department)


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0009_user_classroom_permission'),
    ]

    operations = [
        migrations.RunPython(assign_existing_faculty_department, migrations.RunPython.noop),
    ]
