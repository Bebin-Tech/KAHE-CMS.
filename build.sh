#!/usr/bin/env bash
# exit on error
set -o errexit

if [ "${RENDER:-false}" = "true" ]; then
  if [ -z "${DATABASE_URL:-}" ] && [ -z "${MYSQL_DATABASE:-}" ]; then
    echo "ERROR: A persistent database is required on Render."
    echo "Set DATABASE_URL to your persistent database URL or configure MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT."
    exit 1
  fi
  if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" != mysql://* ]] && [ -n "${MYSQL_DATABASE:-}" ]; then
    echo "WARNING: DATABASE_URL is not MySQL. Using MYSQL_* variables for persistent MySQL instead."
  elif [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" != mysql://* ]]; then
    echo "WARNING: DATABASE_URL is not MySQL. Using it as the persistent Render database."
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
