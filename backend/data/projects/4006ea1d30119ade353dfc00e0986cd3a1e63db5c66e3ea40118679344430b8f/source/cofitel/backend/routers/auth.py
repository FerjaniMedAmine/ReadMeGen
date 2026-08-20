from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import get_db ,require_admin
from schemas.auth import LoginRequest
from security import create_access_token, verify_password


router = APIRouter(prefix="/auth", tags=["Authentication"])



@router.post("/login") 
def login(data: LoginRequest, db: Session = Depends(get_db)):
    username = data.username.strip()

    result = db.execute(
        text("""
            SELECT id, username, password_hash, role
            FROM users
            WHERE username = :username
        """),
        {"username": username},
    )

    user = result.mappings().first()

    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
    }



@router.get("/admin-test")
def admin_test(current_user: dict = Depends(require_admin)):
    return {
        "message": "Accès administrateur autorisé",
        "user": current_user
    }