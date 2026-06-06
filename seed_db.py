import sqlite3
from backend.auth import get_password_hash

def seed():
    conn = sqlite3.connect('kahe_cms.db')
    cursor = conn.cursor()

    # Add Admin User if not exists
    admin_pass = get_password_hash('admin123')
    cursor.execute("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                   ('Admin User', 'admin@kahe.edu', admin_pass, 'admin'))

    # Add Sample Rooms
    rooms = [
        ('A-101', 'Classroom', 60, 'AI & DS', 'AVAILABLE'),
        ('B-205', 'Lab', 30, 'Physics', 'AVAILABLE'),
        ('S-01', 'Seminar Hall', 200, 'General', 'AVAILABLE'),
        ('C-302', 'Office', 2, 'Mathematics', 'AVAILABLE')
    ]
    
    for room in rooms:
        cursor.execute("INSERT OR IGNORE INTO rooms (room_number, type, capacity, department, status) VALUES (?, ?, ?, ?, ?)", room)

    # Add Departments
    departments = [
        ('Languages',),
        ('Computer Science',),
        ('Mathematics',),
        ('General Education',),
        ('AI & DS (Artificial Intelligence and Data Science)',)
    ]
    for dept in departments:
        cursor.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", dept)

    # Add Subjects exactly as requested
    subjects = [
        ('Language-Tamil (III)', 'Languages'),
        ('Language-English (III)', 'Languages'),
        ('Operating System', 'Computer Science'),
        ('Computer Networks', 'Computer Science'),
        ('Operation Research', 'Mathematics'),
        ('Python for Data Science (Practical)', 'Computer Science'),
        ('Community Engagement and Social Responsibility', 'General Education'),
        ('Machine Learning', 'AI & DS (Artificial Intelligence and Data Science)'),
        ('Natural Language Processing', 'AI & DS (Artificial Intelligence and Data Science)'),
        ('Data Visualization', 'AI & DS (Artificial Intelligence and Data Science)')
    ]
    for sub in subjects:
        # Using REPLACE instead of IGNORE to ensure names are updated to exact strings
        cursor.execute("INSERT OR REPLACE INTO subjects (name, department_name) VALUES (?, ?)", sub)

    # Add Sample Schedules exactly from image
    cursor.execute("SELECT id FROM rooms WHERE room_number = 'A-101'")
    a101_id = cursor.fetchone()[0]

    # Clear old schedules
    cursor.execute("DELETE FROM schedules")

    schedules = [
        # Monday
        (1, a101_id, 'Python (PY) Lab', '09:00 AM - 09:50 AM', 'Monday'),
        (1, a101_id, 'Python (PY) Lab', '09:50 AM - 10:55 AM', 'Monday'),
        (1, a101_id, 'English (ENG)', '11:15 AM - 12:00 PM', 'Monday'),
        (1, a101_id, 'Operating System (OS)', '12:00 PM - 12:45 PM', 'Monday'),
        (1, a101_id, 'Mathematics (MATHS)', '01:30 PM - 02:20 PM', 'Monday'),
        (1, a101_id, 'Computer Networks (CN)', '02:20 PM - 03:10 PM', 'Monday'),

        # Tuesday
        (1, a101_id, 'Computer Networks (CN) Lab', '09:00 AM - 09:50 AM', 'Tuesday'),
        (1, a101_id, 'Computer Networks (CN) Lab', '09:50 AM - 10:55 AM', 'Tuesday'),
        (1, a101_id, 'English (ENG)', '12:00 PM - 12:45 PM', 'Tuesday'),
        (1, a101_id, 'Tamil (TAMIL)', '01:30 PM - 02:20 PM', 'Tuesday'),
        (1, a101_id, 'Mathematics (MATHS)', '02:20 PM - 03:10 PM', 'Tuesday'),

        # Wednesday
        (1, a101_id, 'Operating System (OS)', '09:00 AM - 09:50 AM', 'Wednesday'),
        (1, a101_id, 'Computer Networks (CN)', '09:50 AM - 10:55 AM', 'Wednesday'),
        (1, a101_id, 'Python (PY) Theory', '11:15 AM - 12:00 PM', 'Wednesday'),
        (1, a101_id, 'Operating System (OS)', '12:00 PM - 12:45 PM', 'Wednesday'),
        (1, a101_id, 'CESR', '01:30 PM - 02:20 PM', 'Wednesday'),
        (1, a101_id, 'Tamil (TAMIL)', '02:20 PM - 03:10 PM', 'Wednesday'),

        # Thursday
        (1, a101_id, 'Operating System (OS)', '09:00 AM - 09:50 AM', 'Thursday'),
        (1, a101_id, 'Tamil (TAMIL)', '09:50 AM - 10:55 AM', 'Thursday'),
        (1, a101_id, 'Mathematics (MATHS)', '11:15 AM - 12:00 PM', 'Thursday'),
        (1, a101_id, 'Computer Networks (CN) Theory', '12:00 PM - 12:45 PM', 'Thursday'),
        (1, a101_id, 'Computer Networks (CN)', '01:30 PM - 02:20 PM', 'Thursday'),
        (1, a101_id, 'English (ENG)', '02:20 PM - 03:10 PM', 'Thursday'),

        # Friday
        (1, a101_id, 'Mathematics (MATHS)', '09:00 AM - 09:50 AM', 'Friday'),
        (1, a101_id, 'Operating System (OS)', '09:50 AM - 10:55 AM', 'Friday'),
        (1, a101_id, 'Computer Networks (CN)', '11:15 AM - 12:00 PM', 'Friday'),
        (1, a101_id, 'Python (PY) Lab', '12:00 PM - 12:45 PM', 'Friday'),
        (1, a101_id, 'Tamil (TAMIL)', '01:30 PM - 02:20 PM', 'Friday'),
        (1, a101_id, 'CESR', '02:20 PM - 03:10 PM', 'Friday'),
    ]

    for schedule in schedules:
        cursor.execute("INSERT INTO schedules (faculty_id, room_id, subject, time_slot, day_of_week) VALUES (?, ?, ?, ?, ?)", schedule)

    conn.commit()
    conn.close()
    print("Database seeded with exact subject names successfully!")

if __name__ == "__main__":
    seed()
