from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db, require_admin
from schemas.users import UserPayload
from security import hash_password


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
def get_users(
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    result = db.execute(
        text("""
        SELECT id, username, role, created_at
        FROM users
        ORDER BY username
    """)
    )

    return [dict(row) for row in result.mappings().all()]


@router.post("")
def ajouter_user(
    data: UserPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    username = data.username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur obligatoire")

    if not data.password:
        raise HTTPException(status_code=400, detail="Mot de passe obligatoire")

    if not data.role:
        raise HTTPException(status_code=400, detail="Rôle obligatoire")

    password_hash = hash_password(data.password)

    try:
        result = db.execute(
            text("""
    INSERT INTO users (username, password_hash, role)
    VALUES (:username, :password_hash, :role)
    RETURNING id, username, role, created_at
"""),
            {"username": username, "password_hash": password_hash, "role": data.role},
        )

        user = result.mappings().first()
        db.commit()

        return {"message": "Utilisateur ajouté", "user": dict(user)}

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur existe déjà")


@router.put("/{id}")
def modifier_user(
    id: int,
    data: UserPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    username = data.username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur obligatoire")

    try:
        if data.password:
            password_hash = hash_password(data.password)

            result = db.execute(
                text("""
                UPDATE users
                SET username = :username,
                    password_hash = :password_hash
                WHERE id = :id
                RETURNING id, username, role, created_at
            """),
                {"id": id, "username": username, "password_hash": password_hash},
            )

        else:
            result = db.execute(
                text("""
                UPDATE users
                SET username = :username
                WHERE id = :id
                RETURNING id, username, role, created_at
            """),
                {"id": id, "username": username},
            )

        user = result.mappings().first()

        if not user:
            db.rollback()
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        db.commit()

        return {"message": "Utilisateur modifié", "user": dict(user)}

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur existe déjà")


@router.delete("/{id}")
def supprimer_user(
    id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)
):
    result = db.execute(
        text("""
        DELETE FROM users
        WHERE id = :id
        RETURNING id, username, role
    """),
        {"id": id},
    )

    user = result.mappings().first()

    if not user:
        db.rollback()
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    db.commit()

    return {"message": "Utilisateur supprimé", "user": dict(user)}
