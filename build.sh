#!/usr/bin/env bash
# exit on error
set -o errexit

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
