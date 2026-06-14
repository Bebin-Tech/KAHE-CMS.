import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Calculate the absolute path to the root directory's database
# Since this file is in CMS/backend/database.py, parent of parent is CMS root.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DB_PATH = os.path.join(BASE_DIR, 'kahe_cms.db')
ROOT_DB_URL = f"sqlite:///{ROOT_DB_PATH}"

# 2. Get the environment variable or fallback to our root database
env_url = os.getenv("DATABASE_URL", "").strip()

def clean_db_url(url):
    if not url: return None
    # Handle Render/Heroku environment quirks
    if '="' in url:
        import re
        match = re.search(r'"([^"]*)"', url)
        if match: url = match.group(1)
    elif url.startswith("DATABASE_URL="):
        url = url.replace("DATABASE_URL=", "")
    
    url = url.strip().strip("'").strip('"')
    
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    return url

cleaned_env_url = clean_db_url(env_url)

# 3. Decision Logic: Use ENV if provided and valid, otherwise use ROOT_DB_URL
if cleaned_env_url:
    SQLALCHEMY_DATABASE_URL = cleaned_env_url
else:
    # FORCE the use of the absolute root database path to prevent data loss
    SQLALCHEMY_DATABASE_URL = ROOT_DB_URL

# 4. Engine Configuration
engine_kwargs = {"pool_pre_ping": True}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800
    })
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        sep = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
        SQLALCHEMY_DATABASE_URL += f"{sep}sslmode=require"

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print(f"DATABASE_CONNECTION: {SQLALCHEMY_DATABASE_URL}")
