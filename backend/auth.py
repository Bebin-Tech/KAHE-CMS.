import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
try:
    from . import database, models, schemas
except ImportError:
    import database, models, schemas

# Set up logging
logger = logging.getLogger(__name__)

# Security Constants
# Use a static key for dev, environment for production.
# IMPORTANT: On Render, ensure SECRET_KEY is set in environment variables.
SECRET_KEY = os.getenv("SECRET_KEY", "KAHE_SECURE_INSTITUTIONAL_KEY_2024_STABLE")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hour session

# Explicitly defining bcrypt configuration for cross-platform stability
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12 # Standard rounds
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against its hashed version."""
    if not plain_password or not hashed_password:
        return False
    try:
        # Some legacy hashes might start with $2y$ (PHP) or $2b$. passlib handles this.
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password Verification Engine Error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generates a secure hash from a plain password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """Validates the current session token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid institutional credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email, role=role)
    except JWTError as e:
        logger.warning(f"JWT Validation Failure: {e}")
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        logger.warning(f"Identity '{token_data.email}' not found in registry.")
        raise credentials_exception
    return user

def check_admin(user: models.User = Depends(get_current_user)):
    """Enforces admin access."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Administrative access required."
        )
    return user

def check_faculty(user: models.User = Depends(get_current_user)):
    """Enforces faculty/hod level access."""
    if user.role not in ["admin", "faculty", "hod"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Faculty access required."
        )
    return user
