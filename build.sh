#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Add backend and its settings to python path
export PYTHONPATH=$PYTHONPATH:$(pwd)/backend/cms_project

# Move to backend directory to run manage commands
cd backend/cms_project

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Initialize institutional identity (Create Admin)
python init_db.py
