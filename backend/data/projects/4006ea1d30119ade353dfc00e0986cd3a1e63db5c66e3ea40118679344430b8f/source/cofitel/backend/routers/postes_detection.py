from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_current_user, get_db, require_admin
from schemas.postes_detection import PosteDetectionPayload


router = APIRouter(tags=["Postes de détection"])


@router.get("/ilots/{id}/postes-detection")
def get_postes_ilot(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ilot_result = db.execute(
        text("""
            SELECT id
            FROM ilots
            WHERE id = :id
        """),
        {"id": id},
    )

    if not ilot_result.mappings().first():
        raise HTTPException(
            status_code=404,
            detail="Îlot introuvable",
        )

    result = db.execute(
        text("""
            SELECT
                id,
                name,
                ilots_id
            FROM postes_detection
            WHERE ilots_id = :id
            ORDER BY name
        """),
        {"id": id},
    )

    postes = [dict(row) for row in result.mappings().all()]
    return postes


@router.get("/postes-detection/{id}")
def get_poste_detection(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT
                pd.id,
                pd.name,
                pd.ilots_id,
                i.name AS ilot_name
            FROM postes_detection pd
            JOIN ilots i ON i.id = pd.ilots_id
            WHERE pd.id = :id
        """),
        {"id": id},
    )

    poste = result.mappings().first()

    if not poste:
        raise HTTPException(
            status_code=404,
            detail="Poste de détection introuvable",
        )

    return dict(poste)


@router.post("/ilots/{id}/postes-detection")
def ajouter_poste_detection(
    id: int,
    data: PosteDetectionPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom du poste de détection est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                INSERT INTO postes_detection (name, ilots_id)
                VALUES (:name, :ilots_id)
                RETURNING id, name, ilots_id
            """),
            {
                "name": name,
                "ilots_id": id,
            },
        )

        poste = result.mappings().first()
        db.commit()

        return {
            "message": "Poste de détection ajouté",
            "poste": dict(poste),
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Poste de détection déjà existant "
                "ou îlot invalide"
            ),
        )


@router.put("/postes-detection/{id}")
def modifier_poste_detection(
    id: int,
    data: PosteDetectionPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Le nom du poste de détection est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                UPDATE postes_detection
                SET name = :name
                WHERE id = :id
                RETURNING id, name, ilots_id
            """),
            {
                "id": id,
                "name": name,
            },
        )

        poste = result.mappings().first()

        if not poste:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail="Poste de détection introuvable",
            )

        db.commit()

        return {
            "message": "Poste de détection modifié",
            "poste": dict(poste),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible de modifier le poste de détection. "
                "Le nom est peut-être déjà utilisé."
            ),
        )


@router.delete("/postes-detection/{id}")
def supprimer_poste_detection(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        poste_result = db.execute(
            text("""
                SELECT id, name, ilots_id
                FROM postes_detection
                WHERE id = :id
            """),
            {"id": id},
        )

        poste = poste_result.mappings().first()

        if not poste:
            raise HTTPException(
                status_code=404,
                detail="Poste de détection introuvable",
            )

        # Supprimer les codes liés aux types du poste.
        db.execute(
            text("""
                DELETE FROM code_erreur
                WHERE type_defauts_id IN (
                    SELECT id
                    FROM type_defauts
                    WHERE postes_detection_id = :id
                )
            """),
            {"id": id},
        )

        # Supprimer les types liés au poste.
        db.execute(
            text("""
                DELETE FROM type_defauts
                WHERE postes_detection_id = :id
            """),
            {"id": id},
        )

        # Supprimer le poste.
        db.execute(
            text("""
                DELETE FROM postes_detection
                WHERE id = :id
            """),
            {"id": id},
        )

        db.commit()

        return {
            "message": "Poste de détection supprimé",
            "poste": dict(poste),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer le poste de détection",
        )