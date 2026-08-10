import os
import dj_database_url
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

# Path to settings.py is: ROOT/backend/cms_project/cms_project/settings.py
# BASE_DIR reaches ROOT/backend/cms_project (where manage.py is)
BASE_DIR = Path(__file__).resolve().parent.parent
# ROOT_DIR reaches project root
ROOT_DIR = BASE_DIR.parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-kahe-cms-production-ready-secret-key')

DEBUG = 'RENDER' not in os.environ

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'cms',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'cms_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(ROOT_DIR, 'frontend', 'build')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'cms_project.wsgi.application'

# Robust Database Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
IS_RENDER = 'RENDER' in os.environ

if DATABASE_URL:
    # Clean the URL to avoid "Scheme ://" error caused by empty or malformed strings
    DATABASE_URL = DATABASE_URL.strip().strip('"').strip("'")

if DATABASE_URL and '://' in DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=IS_RENDER,
        )
    }
    if DATABASES['default']['ENGINE'] == 'django.db.backends.mysql':
        DATABASES['default'].setdefault('OPTIONS', {})
        DATABASES['default']['OPTIONS'].setdefault('charset', 'utf8mb4')
    elif IS_RENDER:
        raise ImproperlyConfigured(
            'Render deployment must use MySQL for persistent KAHE CMS data. '
            'Set DATABASE_URL to a mysql:// connection string.'
        )
elif os.environ.get('MYSQL_DATABASE'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('MYSQL_DATABASE'),
            'USER': os.environ.get('MYSQL_USER', 'root'),
            'PASSWORD': os.environ.get('MYSQL_PASSWORD', ''),
            'HOST': os.environ.get('MYSQL_HOST', '127.0.0.1'),
            'PORT': os.environ.get('MYSQL_PORT', '3306'),
            'OPTIONS': {
                'charset': 'utf8mb4',
            },
        }
    }
elif IS_RENDER:
    raise ImproperlyConfigured(
        'Persistent MySQL configuration is required on Render. Set DATABASE_URL to a mysql:// URL '
        'or configure MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, and MYSQL_PORT.'
    )
else:
    # Fallback to SQLite when no external database is configured.
    # For permanent production data, configure DATABASE_URL or MYSQL_* values.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ROOT_DIR / 'kahe_cms.db',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'cms.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Frontend build directory
FRONTEND_DIR = os.path.join(ROOT_DIR, 'frontend', 'build')
FRONTEND_STATIC_DIR = os.path.join(FRONTEND_DIR, 'static')

# Serve React public assets such as /logo.svg and /classroom-card-bg.png.
WHITENOISE_ROOT = FRONTEND_DIR

# Only collect the React static directory so /static/js/... resolves correctly.
if os.path.exists(FRONTEND_STATIC_DIR):
    STATICFILES_DIRS = [
        FRONTEND_STATIC_DIR,
    ]
else:
    STATICFILES_DIRS = []

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

CORS_ALLOW_ALL_ORIGINS = True
