from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_current_user, get_db, require_admin
from schemas.types_defaut import TypeDefautPayload


router = APIRouter(tags=["Types de défaut"])


@router.get("/postes-detection/{id}/types-defaut")
def get_types_defaut_poste(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    poste_result = db.execute(
        text("""
            SELECT id
            FROM postes_detection
            WHERE id = :id
        """),
        {"id": id},
    )

    if not poste_result.mappings().first():
        raise HTTPException(
            status_code=404,
            detail="Poste de détection introuvable",
        )

    result = db.execute(
        text("""
            SELECT
                id,
                name,
                postes_detection_id
            FROM type_defauts
            WHERE postes_detection_id = :id
            ORDER BY name
        """),
        {"id": id},
    )

    types_defaut = [
        dict(row)
        for row in result.mappings().all()
    ]

    return types_defaut


@router.get("/types-defaut/{id}")
def get_type_defaut(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT
                td.id,
                td.name,
                td.postes_detection_id,
                pd.name AS poste_name,
                pd.ilots_id
            FROM type_defauts td
            JOIN postes_detection pd
                ON pd.id = td.postes_detection_id
            WHERE td.id = :id
        """),
        {"id": id},
    )

    type_defaut = result.mappings().first()

    if not type_defaut:
        raise HTTPException(
            status_code=404,
            detail="Type de défaut introuvable",
        )

    return dict(type_defaut)


@router.post("/postes-detection/{id}/types-defaut")
def ajouter_type_defaut(
    id: int,
    data: TypeDefautPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom du type de défaut est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                INSERT INTO type_defauts (
                    name,
                    postes_detection_id
                )
                VALUES (
                    :name,
                    :postes_detection_id
                )
                RETURNING
                    id,
                    name,
                    postes_detection_id
            """),
            {
                "name": name,
                "postes_detection_id": id,
            },
        )

        type_defaut = result.mappings().first()
        db.commit()

        return {
            "message": "Type de défaut ajouté",
            "type_defaut": dict(type_defaut),
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible d'ajouter le type de défaut "
                "ou poste de détection invalide"
            ),
        )


@router.put("/types-defaut/{id}")
def modifier_type_defaut(
    id: int,
    data: TypeDefautPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom du type de défaut est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                UPDATE type_defauts
                SET name = :name
                WHERE id = :id
                RETURNING
                    id,
                    name,
                    postes_detection_id
            """),
            {
                "id": id,
                "name": name,
            },
        )

        type_defaut = result.mappings().first()

        if not type_defaut:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail="Type de défaut introuvable",
            )

        db.commit()

        return {
            "message": "Type de défaut modifié",
            "type_defaut": dict(type_defaut),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de modifier le type de défaut",
        )


@router.delete("/types-defaut/{id}")
def supprimer_type_defaut(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        type_result = db.execute(
            text("""
                SELECT
                    id,
                    name,
                    postes_detection_id
                FROM type_defauts
                WHERE id = :id
            """),
            {"id": id},
        )

        type_defaut = type_result.mappings().first()

        if not type_defaut:
            raise HTTPException(
                status_code=404,
                detail="Type de défaut introuvable",
            )

        # Supprimer les codes du type de défaut.
        db.execute(
            text("""
                DELETE FROM code_erreur
                WHERE type_defauts_id = :id
            """),
            {"id": id},
        )

        # Supprimer le type de défaut.
        db.execute(
            text("""
                DELETE FROM type_defauts
                WHERE id = :id
            """),
            {"id": id},
        )

        db.commit()

        return {
            "message": "Type de défaut supprimé",
            "type_defaut": dict(type_defaut),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer le type de défaut",
        )