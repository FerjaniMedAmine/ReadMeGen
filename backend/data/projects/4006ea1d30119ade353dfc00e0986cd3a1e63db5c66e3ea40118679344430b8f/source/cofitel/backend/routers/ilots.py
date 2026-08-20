from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_current_user, get_db, require_admin
from schemas.ilots import IlotPayload


router = APIRouter(tags=["Ilots"])


@router.get("/ilots")
def get_ilots(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT id, name
            FROM ilots
            ORDER BY name
        """)
    )

    ilots = [dict(row) for row in result.mappings().all()]
    return ilots


@router.get("/ilots/{id}")
def get_ilot(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT id, name
            FROM ilots
            WHERE id = :id
        """),
        {"id": id},
    )

    ilot = result.mappings().first()

    if not ilot:
        raise HTTPException(
            status_code=404,
            detail="Îlot introuvable",
        )

    return dict(ilot)


@router.post("/ilots")
def ajouter_ilot(
    data: IlotPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom de l'îlot est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                INSERT INTO ilots (name)
                VALUES (:name)
                RETURNING id, name
            """),
            {"name": name},
        )

        ilot = result.mappings().first()
        db.commit()

        return {
            "message": "Îlot ajouté",
            "ilot": dict(ilot),
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible d'ajouter l'îlot",
        )


@router.put("/ilots/{id}")
def modifier_ilot(
    id: int,
    data: IlotPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom de l'îlot est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                UPDATE ilots
                SET name = :name
                WHERE id = :id
                RETURNING id, name
            """),
            {
                "id": id,
                "name": name,
            },
        )

        ilot = result.mappings().first()

        if not ilot:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail="Îlot introuvable",
            )

        db.commit()

        return {
            "message": "Îlot modifié",
            "ilot": dict(ilot),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de modifier l'îlot",
        )


@router.delete("/ilots/{id}")
def supprimer_ilot(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        ilot_result = db.execute(
            text("""
                SELECT id, name
                FROM ilots
                WHERE id = :id
            """),
            {"id": id},
        )

        ilot = ilot_result.mappings().first()

        if not ilot:
            raise HTTPException(
                status_code=404,
                detail="Îlot introuvable",
            )

        # Suppression des codes erreur liés aux types de défaut
        # des postes appartenant à cet îlot.
        db.execute(
            text("""
                DELETE FROM code_erreur
                WHERE type_defauts_id IN (
                    SELECT td.id
                    FROM type_defauts td
                    JOIN postes_detection pd
                        ON pd.id = td.postes_detection_id
                    WHERE pd.ilots_id = :id
                )
            """),
            {"id": id},
        )

        # Suppression des types de défaut.
        db.execute(
            text("""
                DELETE FROM type_defauts
                WHERE postes_detection_id IN (
                    SELECT id
                    FROM postes_detection
                    WHERE ilots_id = :id
                )
            """),
            {"id": id},
        )

        # Suppression des postes de détection.
        db.execute(
            text("""
                DELETE FROM postes_detection
                WHERE ilots_id = :id
            """),
            {"id": id},
        )

        # Suppression de l'îlot.
        db.execute(
            text("""
                DELETE FROM ilots
                WHERE id = :id
            """),
            {"id": id},
        )

        db.commit()

        return {
            "message": "Îlot supprimé",
            "ilot": dict(ilot),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer l'îlot",
        )