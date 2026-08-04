#!/usr/bin/env bash
# exit on error
set -o errexit

DATABASE_URL_TRIMMED="$(printf '%s' "${DATABASE_URL:-}" | tr -d '[:space:]')"

if [ -n "$RENDER" ] && { [ -z "$DATABASE_URL_TRIMMED" ] || ! printf '%s' "$DATABASE_URL_TRIMMED" | grep -q '://'; }; then
  echo "ERROR: DATABASE_URL is required on Render."
  echo "Connect a Render PostgreSQL database so classrooms and user accounts are stored permanently."
  exit 1
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

# Initialize institutional identity (Create Admin)
# init_db.py is also in backend/cms_project
python init_db.py
