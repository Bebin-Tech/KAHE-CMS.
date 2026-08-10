#!/usr/bin/env bash
# exit on error
set -o errexit

if [ "${RENDER:-false}" = "true" ]; then
  if [ -z "${DATABASE_URL:-}" ] && [ -z "${MYSQL_DATABASE:-}" ]; then
    echo "ERROR: Persistent MySQL is required on Render."
    echo "Add DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME or configure MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT."
    exit 1
  fi
  if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" != mysql://* ]] && [ -z "${MYSQL_DATABASE:-}" ]; then
    echo "ERROR: DATABASE_URL on Render must be a MySQL URL."
    echo "Expected format: mysql://USER:PASSWORD@HOST:3306/DBNAME"
    echo "Alternatively configure MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT."
    exit 1
  fi
  if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" != mysql://* ]] && [ -n "${MYSQL_DATABASE:-}" ]; then
    echo "WARNING: DATABASE_URL is not MySQL. Using MYSQL_* variables for persistent MySQL instead."
  fi
fi

# Install dependencies (requirements.txt is in the root)
pip install -r requirements.txt

# Build frontend
cd frontend
npm install
CI=false npm run build
cd ..

# Move to the directory containing manage.py
cd backend/cms_project

# Add current directory to PYTHONPATH so manage.py finds cms_project.settings
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Optional first-time admin bootstrap. Keep disabled during normal deploys so
# deleted or edited database users are not recreated or overwritten.
if [ "${INIT_DEFAULT_USERS:-false}" = "true" ]; then
  python init_db.py
fi
