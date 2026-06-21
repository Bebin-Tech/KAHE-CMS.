import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms_project.settings')
django.setup()

from cms.models import User

def create_institutional_admin():
    # User-requested credentials
    email = 'admin@kahe.edu'
    password = 'admin123'
    
    # We set both username and email to 'admin@kahe.edu' 
    # to ensure the login screen works no matter which one it sends.
    username = email

    print(f"Initializing identity for: {email}...")

    # Check if user already exists
    user = User.objects.filter(username=username).first()
    
    if not user:
        # Create new superuser
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            role='super_admin',
            first_name='System',
            last_name='Admin',
            status='Active'
        )
        print(f"SUCCESS: Admin account created with password '{password}'")
    else:
        # Update existing user password
        user.email = email
        user.set_password(password)
        user.role = 'super_admin'
        user.save()
        print(f"SUCCESS: Existing admin account updated with password '{password}'")

if __name__ == "__main__":
    create_institutional_admin()
