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
    
    # Handle common formatting errors
    url = url.strip().strip("'").strip('"')
    
    # If the user literally typed DATABASE_URL=... into the field
    if url.startswith("DATABASE_URL="):
        url = url.replace("DATABASE_URL=", "", 1).strip().strip("'").strip('"')
        
    # Handle Render/Heroku postgres format
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    # Validation: Must look like a URL
    if "://" not in url:
        # Silently ignore common non-URL strings often found in shell environments
        if not any(x in url.lower() for x in ["python", "pip", "bash", "cd "]):
            print(f"DATABASE WARNING: Ignored invalid DATABASE_URL content: {url[:20]}...")
        return None
        
    # Filter out common 'placeholder' values
    if url.lower() in ["none", "null", "undefined", "false", "true", "0", "1"]:
        return None
    
    return url

cleaned_env_url = clean_db_url(env_url)

# 3. Decision Logic: Use ENV if provided and valid, otherwise use ROOT_DB_URL
if cleaned_env_url:
    SQLALCHEMY_DATABASE_URL = cleaned_env_url
    print(f"DATABASE: Using environment-provided database URL (protocol: {SQLALCHEMY_DATABASE_URL.split('://')[0]})")
else:
    SQLALCHEMY_DATABASE_URL = ROOT_DB_URL
    print(f"DATABASE: Using local SQLite fallback (absolute path to {ROOT_DB_PATH})")

# 4. Engine Configuration
engine_kwargs = {"pool_pre_ping": True}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Postgres-specific optimizations
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800
    })
    # Ensure SSL for hosted databases
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        sep = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
        SQLALCHEMY_DATABASE_URL += f"{sep}sslmode=require"

# Create engine with immediate feedback
print(f"DATABASE: Attempting to initialize engine...")
try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
    # Verification of URL parsing
    from sqlalchemy.engine.url import make_url
    parsed_url = make_url(SQLALCHEMY_DATABASE_URL)
    print(f"DATABASE: Engine initialized for {parsed_url.drivername} driver.")
except Exception as e:
    print(f"CRITICAL DATABASE ERROR: SQLAlchemy could not parse the URL.")
    print(f"REASON: {str(e)}")
    print(f"FALLING BACK TO SQLITE TO PREVENT BOOT CRASH...")
    SQLALCHEMY_DATABASE_URL = ROOT_DB_URL
    engine_kwargs = {"pool_pre_ping": True, "connect_args": {"check_same_thread": False}}
    engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
    print(f"DATABASE: Fallback successful.")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print(f"DATABASE_CONNECTION: {SQLALCHEMY_DATABASE_URL}")
