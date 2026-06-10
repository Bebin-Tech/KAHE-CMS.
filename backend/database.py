import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

raw_url = os.getenv("DATABASE_URL", "sqlite:///./kahe_cms.db").strip()

# Extreme cleanup for user copy-paste errors (handling commands accidentally pasted as values)
if '="' in raw_url:
    # Extracts everything between quotes if the user pasted a command
    import re
    match = re.search(r'"([^"]*)"', raw_url)
    if match:
        raw_url = match.group(1)
elif raw_url.startswith("DATABASE_URL="):
    raw_url = raw_url.replace("DATABASE_URL=", "")

# Final robust cleanup
if "://" not in raw_url and not raw_url.startswith("sqlite"):
    print(f"CRITICAL ERROR: DATABASE_URL is invalid. Value received: {raw_url[:20]}...")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./kahe_cms.db" # Fallback to local
else:
    SQLALCHEMY_DATABASE_URL = raw_url

# Handle potential quotes
if (SQLALCHEMY_DATABASE_URL.startswith('"') and SQLALCHEMY_DATABASE_URL.endswith('"')) or \
   (SQLALCHEMY_DATABASE_URL.startswith("'") and SQLALCHEMY_DATABASE_URL.endswith("'")):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL[1:-1]

# Fix the Render 'postgres' vs 'postgresql' driver requirement
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if "postgresql" in SQLALCHEMY_DATABASE_URL and "sslmode" not in SQLALCHEMY_DATABASE_URL:
    sep = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
    SQLALCHEMY_DATABASE_URL += f"{sep}sslmode=require"

engine_kwargs = {
    "pool_pre_ping": True,  # Verifies connection before use
    "pool_recycle": 300,    # Reconnect every 5 minutes
}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "postgresql" in SQLALCHEMY_DATABASE_URL:
    # Render PostgreSQL often requires specialized SSL handling
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        # If it's an internal URL, we might not need SSL, but require is usually safe
        # If it's external, we definitely need it.
        sep = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
        SQLALCHEMY_DATABASE_URL += f"{sep}sslmode=require"

# Create engine with improved connection pooling
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
