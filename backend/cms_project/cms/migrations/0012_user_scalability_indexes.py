from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0011_classsession_manual_start_time'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['role', '-date_joined'], name='user_role_joined_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['role', 'status'], name='user_role_status_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['email'], name='user_email_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_active'], name='user_active_idx'),
        ),
    ]
