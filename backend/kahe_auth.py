import os
import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
try:
    from . import database, models, schemas
except ImportError:
    import database, models, schemas

# Set up logging for institutional security monitoring
logger = logging.getLogger("KAHE-AUTH")

# Security Constants
# On Render, ensure SECRET_KEY is set in environment variables for stability
SECRET_KEY = os.getenv("SECRET_KEY", "KAHE_SECURE_INSTITUTIONAL_KEY_2024_STABLE_V1")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hour session for institutional convenience

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its hashed version using bcrypt directly
    to avoid passlib version compatibility issues in production.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        # bcrypt.checkpw expects bytes
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Security Verification Engine Failure: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generates a secure bcrypt hash from a plain password."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generates a JWT access token for the institutional session."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """Validates the institutional session token and retrieves the user identity."""
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
        logger.warning(f"JWT Verification Failure: {e}")
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        logger.warning(f"Identity '{token_data.email}' not found in secure registry.")
        raise credentials_exception
    return user

def check_admin(user: models.User = Depends(get_current_user)):
    """Enforces administrative module access control."""
    if user.role not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Administrative access required."
        )
    return user

def check_hod(user: models.User = Depends(get_current_user)):
    """Enforces HOD level access control."""
    if user.role not in ["super_admin", "admin", "hod", "dean"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HOD level access required."
        )
    return user

def check_principal(user: models.User = Depends(get_current_user)):
    """Enforces Principal/Dean level access control."""
    if user.role not in ["super_admin", "admin", "dean"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Principal/Dean level access required."
        )
    return user

def check_faculty(user: models.User = Depends(get_current_user)):
    """Enforces faculty/staff level access control."""
    if user.role not in ["super_admin", "admin", "faculty", "hod", "dean"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Faculty/Staff level access required."
        )
    return user
