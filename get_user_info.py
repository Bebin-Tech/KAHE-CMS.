import sqlite3
import os

db_path = "kahe_cms.db"
if not os.path.exists(db_path):
    print("Database not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name, email, faculty_id, role, password FROM users WHERE is_deleted = 0")
users = cursor.fetchall()

print(f"Total Active Users: {len(users)}")
print("-" * 50)
for u in users:
    print(f"Name: {u[0]}")
    print(f"Email: {u[1]}")
    print(f"User ID: {u[2]}")
    print(f"Role: {u[3]}")
    # We can't provide the plain text password as they are hashed.
    # But we can note if they are using the default ones.
    print(f"Password: [Securely Hashed]")
    print("-" * 20)

conn.close()
