import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

raw_url = os.getenv("DATABASE_URL", "sqlite:///./kahe_cms.db").strip()

# Cleanup for DATABASE_URL
if '="' in raw_url:
    import re
    match = re.search(r'"([^"]*)"', raw_url)
    if match:
        raw_url = match.group(1)
elif raw_url.startswith("DATABASE_URL="):
    raw_url = raw_url.replace("DATABASE_URL=", "")

if "://" not in raw_url and not raw_url.startswith("sqlite"):
    SQLALCHEMY_DATABASE_URL = "sqlite:///./kahe_cms.db"
else:
    SQLALCHEMY_DATABASE_URL = raw_url

if (SQLALCHEMY_DATABASE_URL.startswith('"') and SQLALCHEMY_DATABASE_URL.endswith('"')) or \
   (SQLALCHEMY_DATABASE_URL.startswith("'") and SQLALCHEMY_DATABASE_URL.endswith("'")):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL[1:-1]

# Fix the Render 'postgres' vs 'postgresql' driver requirement
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_kwargs = {
    "pool_pre_ping": True,
}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Postgres specific settings
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_recycle"] = 1800
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        sep = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
        SQLALCHEMY_DATABASE_URL += f"{sep}sslmode=require"

# Create engine with environment-appropriate arguments
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
