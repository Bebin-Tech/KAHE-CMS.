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

# Initialize institutional identity (Create Admin)
# init_db.py is also in backend/cms_project
python init_db.py
