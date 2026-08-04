import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / 'backend' / 'cms_project'
LOCAL_DB = ROOT_DIR / 'kahe_cms.db'

FIXTURE_MODELS = [
    'cms.Department',
    'cms.User',
    'cms.Block',
    'cms.Room',
    'cms.Subject',
    'cms.Booking',
    'cms.ClassSession',
    'cms.AuditLog',
    'authtoken.Token',
]


def run_manage(args, env):
    command = [sys.executable, 'manage.py', *args]
    print(f'Running: {" ".join(command)}')
    subprocess.run(command, cwd=BACKEND_DIR, env=env, check=True)


def local_env():
    env = os.environ.copy()
    env.pop('DATABASE_URL', None)
    env.pop('RENDER', None)
    env['PYTHONPATH'] = str(BACKEND_DIR)
    return env


def render_env(database_url):
    env = os.environ.copy()
    env['DATABASE_URL'] = database_url
    env.pop('RENDER', None)
    env['PYTHONPATH'] = str(BACKEND_DIR)
    return env


def main():
    parser = argparse.ArgumentParser(
        description='Move KAHE CMS essential data from local SQLite to a configured persistent database.'
    )
    parser.add_argument(
        '--replace-target',
        action='store_true',
        help='Flush the target PostgreSQL database before loading local data.',
    )
    args = parser.parse_args()

    database_url = (os.environ.get('DATABASE_URL') or '').strip().strip('"').strip("'")
    if not database_url or '://' not in database_url:
        raise SystemExit(
            'DATABASE_URL is required. Use the Render PostgreSQL External Database URL.\n'
            'PowerShell example:\n'
            '$env:DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DBNAME"; '
            'python migrate_to_render.py'
        )

    if not LOCAL_DB.exists():
        raise SystemExit(f'Local SQLite database not found: {LOCAL_DB}')

    if not BACKEND_DIR.exists():
        raise SystemExit(f'Backend directory not found: {BACKEND_DIR}')

    with tempfile.TemporaryDirectory() as temp_dir:
        fixture_path = Path(temp_dir) / 'kahe_render_fixture.json'

        print(f'Exporting local data from {LOCAL_DB}...')
        run_manage([
            'dumpdata',
            *FIXTURE_MODELS,
            '--indent', '2',
            '--output', str(fixture_path),
        ], local_env())

        print('Applying migrations to the target database...')
        target_env = render_env(database_url)
        run_manage(['migrate'], target_env)

        if args.replace_target:
            print('Flushing target database...')
            run_manage(['flush', '--noinput'], target_env)
            run_manage(['migrate'], target_env)

        print('Loading local data into the target database...')
        run_manage(['loaddata', str(fixture_path)], target_env)

        print('Synchronizing default admin accounts...')
        subprocess.run(
            [sys.executable, 'init_db.py'],
            cwd=BACKEND_DIR,
            env=target_env,
            check=True,
        )

    print('Migration completed successfully.')
    print('Restart or redeploy the app after confirming the database environment variables are set.')


if __name__ == '__main__':
    main()
