import sqlite3
import os

db_path = 'kahe_cms.db'
if not os.path.exists(db_path):
    print("Database not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Tables: {[t[0] for t in tables]}")

for table in [t[0] for t in tables]:
    print(f"\n--- {table} ---")
    cursor.execute(f"PRAGMA table_info({table})")
    cols = cursor.fetchall()
    print(f"Columns: {[c[1] for c in cols]}")
    cursor.execute(f"SELECT * FROM {table} LIMIT 3")
    rows = cursor.fetchall()
    for r in rows:
        print(r)

conn.close()
