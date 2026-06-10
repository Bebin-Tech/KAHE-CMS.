import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kahe_cms.db").strip()

# Handle potential quotes if user accidentally included them
if (SQLALCHEMY_DATABASE_URL.startswith('"') and SQLALCHEMY_DATABASE_URL.endswith('"')) or \
   (SQLALCHEMY_DATABASE_URL.startswith("'") and SQLALCHEMY_DATABASE_URL.endswith("'")):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL[1:-1]

# If using PostgreSQL (Render), we need to handle the 'postgres://' vs 'postgresql://' issue
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_kwargs = {
    "pool_pre_ping": True,  # Verifies connection before use
    "pool_recycle": 300,    # Reconnect every 5 minutes
}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "postgresql" in SQLALCHEMY_DATABASE_URL:
    # Ensure SSL is handled correctly if not in URL
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        if "?" in SQLALCHEMY_DATABASE_URL:
            SQLALCHEMY_DATABASE_URL += "&sslmode=require"
        else:
            SQLALCHEMY_DATABASE_URL += "?sslmode=require"

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
