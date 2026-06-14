import sqlite3
import os

db_path = r"C:\Users\bbebi\OneDrive\Documents\KAHE Campus Management System\kahe_cms.db"
print(f"Checking database at: {db_path}")
if not os.path.exists(db_path):
    print("Database file does not exist!")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {tables}")
        for table in tables:
            t_name = table[0]
            cursor.execute(f"SELECT count(*) FROM {t_name}")
            count = cursor.fetchone()[0]
            print(f"Table '{t_name}' has {count} rows.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
