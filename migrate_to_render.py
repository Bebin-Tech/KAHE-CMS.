import sqlite3
import os
from sqlalchemy import create_engine, Meta_data, Table, select
from sqlalchemy.orm import sessionmaker
from backend import models

# 1. Connect to local SQLite
sqlite_conn = sqlite3.connect('kahe_cms.db')
sqlite_cursor = sqlite_conn.cursor()

# 2. Connect to Render PostgreSQL
postgres_url = os.getenv("DATABASE_URL")
if not postgres_url:
    print("Error: Please set the DATABASE_URL environment variable.")
    exit(1)

if postgres_url.startswith("postgres://"):
    postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(postgres_url)
Session = sessionmaker(bind=engine)
session = Session()

# Ensure tables exist on Render
models.Base.metadata.create_all(engine)

def migrate_table(table_name, model_class):
    print(f"Migrating {table_name}...")
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()
    
    # Get column names
    column_names = [description[0] for description in sqlite_cursor.description]
    
    count = 0
    for row in rows:
        data = dict(zip(column_names, row))
        # Check if record already exists to avoid duplicates
        existing = session.query(model_class).filter_by(id=data['id']).first()
        if not existing:
            new_record = model_class(**data)
            session.add(new_record)
            count += 1
    
    session.commit()
    print(f"Successfully migrated {count} records to {table_name}.")

try:
    migrate_table('users', models.User)
    migrate_table('rooms', models.Room)
    migrate_table('departments', models.Department)
    migrate_table('subjects', models.Subject)
    migrate_table('schedules', models.Schedule)
    migrate_table('bookings', models.Booking)
    migrate_table('class_sessions', models.ClassSession)
    migrate_table('notifications', models.Notification)
    print("\nALL DATA MIGRATED SUCCESSFULLY!")
except Exception as e:
    print(f"\nMigration failed: {e}")
    session.rollback()
finally:
    sqlite_conn.close()
    session.close()
