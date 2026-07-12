#!/usr/bin/env bash
# exit on error
set -o errexit

if [ "$RENDER" = "true" ] && { [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" != *"://"* ]]; }; then
  echo "ERROR: DATABASE_URL is required on Render."
  echo "Create/connect a Render PostgreSQL database, then add its Internal Database URL as DATABASE_URL in this web service."
  echo "The app will not deploy with temporary SQLite because student accounts would disappear after restarts."
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
