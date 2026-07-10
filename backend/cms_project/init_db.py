import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms_project.settings')
django.setup()

from cms.models import User

def create_identities():
    identities = [
        {'username': 'admin', 'email': 'admin@kahe.edu', 'password': 'admin123', 'first': 'System', 'last': 'Admin', 'role': 'super_admin'},
        {'username': 'bebin', 'email': 'bebin@kahe.edu', 'password': 'admin123', 'first': 'Bebin', 'last': 'R', 'role': 'super_admin'}
    ]

    for identity in identities:
        username = identity['username']
        email = identity['email']
        password = identity['password']

        print(f"Initializing identity for: {username}...")

        user = User.objects.filter(username__iexact=username).first() or User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                role=identity['role'],
                first_name=identity['first'],
                last_name=identity['last'],
                status='Active'
            )
            print(f"SUCCESS: Account created for {email}")
        else:
            user.username = username
            user.email = email
            user.first_name = identity['first']
            user.last_name = identity['last']
            user.role = identity['role']
            user.status = 'Active'
            user.is_active = True
            user.set_password(password)
            user.save()
            print(f"SUCCESS: Existing account updated for {email}")

if __name__ == "__main__":
    create_identities()
