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
- **Database**: MySQL for persistent production data / SQLite only for local development.
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

Use the included `render.yaml` blueprint when creating the Render service. For production, connect a persistent MySQL database through `DATABASE_URL` or the `MYSQL_*` environment variables.

If the web service is created manually in Render, create or connect a persistent MySQL database and add one of these configurations:

- `DATABASE_URL`: a MySQL URL such as `mysql://USER:PASSWORD@HOST:3306/DBNAME`.
- MySQL variables: `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_HOST`, `MYSQL_PORT`.

If Render already has a non-MySQL `DATABASE_URL`, replace it with the MySQL URL or add the full `MYSQL_*` variable set. When `MYSQL_DATABASE` is present, the app uses the `MYSQL_*` variables instead.

The current deploy commands are:

- **Build Command**: `./build.sh`
- **Start Command**: `gunicorn --chdir backend/cms_project cms_project.wsgi:application`

If no persistent MySQL database is configured on Render, deployment stops intentionally. This prevents users, departments, subjects, and classrooms from being stored in temporary SQLite storage and disappearing after redeploys.

### Local MySQL From VS Code

Create a `.env` or set these in your VS Code terminal before running Django:

```powershell
$env:MYSQL_DATABASE="kahe_cms"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="your_mysql_password"
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
cd backend/cms_project
python manage.py migrate
python init_db.py
python manage.py runserver
```

All classrooms and users will then be stored in your MySQL database.

## 🔄 Data Migration

To move data from your local SQLite database to another configured database:
```bash
$env:DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DBNAME"; python migrate_to_render.py
```

Use `--replace-target` only when you intentionally want to clear the target database before loading local data.

## 🔒 Security

- Tiered access control for Admins, Faculty, and Students.
- Gzip compression and database connection pooling for maximum responsiveness.

---
*Developed by Bebin R.*
