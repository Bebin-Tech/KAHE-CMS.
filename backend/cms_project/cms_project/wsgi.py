import os
from django.core.exceptions import ImproperlyConfigured
from django.core.wsgi import get_wsgi_application

database_url = os.environ.get('DATABASE_URL', '').strip().strip('"').strip("'")
if os.environ.get('RENDER') == 'true' and '://' not in database_url:
    raise ImproperlyConfigured(
        "DATABASE_URL is required on Render. Connect PostgreSQL before starting the web service."
    )

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms_project.settings')
application = get_wsgi_application()
app = application
