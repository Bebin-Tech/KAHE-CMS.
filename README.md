# KAHE Campus Management System

An optimized, full-stack campus management solution designed for real-time classroom availability tracking and resource management at Karpagam Academy of Higher Education (KAHE).

## 🚀 Key Features

- **Real-Time Classroom Tracking**: Live status (Available/In Use) of all institutional spaces.
- **Dynamic Booking System**: Secure room reservation with conflict detection and automated queuing.
- **Class Session Management**: Seamless start/end of sessions with automated room status updates.
- **Smart Notifications**: Instant alerts when queued rooms become available.
- **Comprehensive Admin Dashboard**: Full control over users, rooms, departments, and subjects.
- **User Directory**: Centralized management of faculty, staff, and student accounts.
- **Usage History**: Detailed logs of classroom utilization and faculty activity.

## 🛠 Tech Stack

- **Frontend**: React.js, Tailwind CSS, Axios, React Router.
- **Backend**: Django, Django REST Framework.
- **Database**: PostgreSQL (Production) / SQLite (Development).
- **Authentication**: JWT (JSON Web Tokens) with Bcrypt password hashing.
- **Deployment**: Render (Unified Web Service).

## 📦 Local Installation

### 1. Backend Setup
```bash
cd backend/cms_project
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r ../../requirements.txt
python manage.py runserver
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 🌍 Production Deployment

This project is configured for a **unified deployment** on Render. The backend automatically serves the frontend build, ensuring high performance and zero CORS issues.

### Render Configuration

Use the included `render.yaml` blueprint when creating the Render service. It provisions the web service and attaches the PostgreSQL database as `DATABASE_URL`.

If the web service is created manually in Render, create or connect a PostgreSQL database and add this environment variable for persistent data:

- `DATABASE_URL`: the internal PostgreSQL connection string from Render.

The current deploy commands are:

- **Build Command**: `./build.sh`
- **Start Command**: `gunicorn --chdir backend/cms_project cms_project.wsgi:application`

If `DATABASE_URL` is missing on Render, deployment stops. This prevents the app from using temporary SQLite storage in production.

## 🔄 Data Migration

To move data from your local SQLite database to your live Render environment:
```bash
$env:DATABASE_URL="YOUR_RENDER_EXTERNAL_POSTGRES_URL_WITH_SSLMODE_REQUIRE"; python migrate_to_render.py
```

Use the PostgreSQL **External Database URL** when running this command from your computer. Use `--replace-target` only when you intentionally want to clear the target database before loading local data.

## 🔒 Security

- Tiered access control for Admins, Faculty, and Students.
- Gzip compression and database connection pooling for maximum responsiveness.

---
*Developed by Bebin R.*
