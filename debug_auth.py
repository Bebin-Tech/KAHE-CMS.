import sqlite3
import bcrypt

db_path = "kahe_cms.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, email, faculty_id, password, role FROM users")
users = cursor.fetchall()

print("User Table Contents:")
for u in users:
    print(f"ID: {u[0]}, Email: {u[1]}, FacultyID: {u[2]}, Role: {u[4]}")
    # Check password hash format
    pwd = u[3]
    if pwd:
        print(f"  Password Hash starts with: {pwd[:10]}...")
    else:
        print("  Password is empty!")

conn.close()
