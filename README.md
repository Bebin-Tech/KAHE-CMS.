# KAHE Campus Management System

An optimized, full-stack campus management solution designed for real-time classroom tracking, faculty scheduling, and resource management at Karpagam Academy of Higher Education (KAHE).

## 🚀 Key Features

- **Real-Time Classroom Tracking**: Live status (Available/In Use) of all institutional spaces.
- **Dynamic Booking System**: Secure room reservation with conflict detection and automated queuing.
- **Class Session Management**: Seamless start/end of sessions with automated room status updates.
- **Smart Notifications**: Instant alerts when queued rooms become available.
- **Comprehensive Admin Dashboard**: Full control over users, rooms, departments, subjects, and schedules.
- **User Directory**: Centralized management of faculty, staff, and student accounts.
- **Usage History**: Detailed logs of classroom utilization and faculty activity.

## 🛠 Tech Stack

- **Frontend**: React.js, Tailwind CSS, Axios, React Router.
- **Backend**: FastAPI (Python), SQLAlchemy ORM.
- **Database**: PostgreSQL (Production) / SQLite (Development).
- **Authentication**: JWT (JSON Web Tokens) with Bcrypt password hashing.
- **Deployment**: Render (Unified Web Service).

## 📦 Local Installation

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 🌍 Production Deployment

This project is configured for a **unified deployment** on Render. The backend automatically serves the frontend build, ensuring high performance and zero CORS issues.

### Render Configuration:
- **Runtime**: `Python 3`
- **Build Command**: `cd frontend && npm install && CI=false npm run build && cd ../backend && pip install -r requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**: 
  - `DATABASE_URL`: Your PostgreSQL connection string.
  - `SECRET_KEY`: A secure random string for JWT.

## 🔄 Data Migration

To move data from your local SQLite database to your live Render environment:
```bash
$env:DATABASE_URL="YOUR_EXTERNAL_POSTGRES_URL"; python migrate_to_render.py
```

## 🔒 Security

- Default institutional credentials: `admin@kahe.edu` / `admin123`.
- Tiered access control for Admins, Faculty, and Students.
- Gzip compression and database connection pooling for maximum responsiveness.

---
*Developed by Bebin R.*
