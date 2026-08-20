from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_db
from schemas.codes_erreur import CodeErreurPayload


router = APIRouter(tags=["Codes erreur"])


@router.get("/types-defaut/{id}/codes-erreur")
def get_codes_erreur_type(
    id: int,
    db: Session = Depends(get_db),
):
    type_result = db.execute(
        text("""
            SELECT id
            FROM type_defauts
            WHERE id = :id
        """),
        {"id": id},
    )

    if not type_result.mappings().first():
        raise HTTPException(
            status_code=404,
            detail="Type de défaut introuvable",
        )

    result = db.execute(
        text("""
            SELECT
                id,
                code,
                type_defauts_id
            FROM code_erreur
            WHERE type_defauts_id = :id
            ORDER BY code
        """),
        {"id": id},
    )

    codes = [dict(row) for row in result.mappings().all()]
    return codes


@router.get("/codes-erreur/{id}")
def get_code_erreur(
    id: int,
    db: Session = Depends(get_db),
):
    result = db.execute(
        text("""
            SELECT
                ce.id,
                ce.code,
                ce.type_defauts_id,
                td.name AS type_defaut_name
            FROM code_erreur ce
            JOIN type_defauts td
                ON td.id = ce.type_defauts_id
            WHERE ce.id = :id
        """),
        {"id": id},
    )

    code_erreur = result.mappings().first()

    if not code_erreur:
        raise HTTPException(
            status_code=404,
            detail="Code erreur introuvable",
        )

    return dict(code_erreur)


@router.post("/types-defaut/{id}/codes-erreur")
def ajouter_code_erreur(
    id: int,
    data: CodeErreurPayload,
    db: Session = Depends(get_db),
):
    code = data.code.strip()

    if not code:
        raise HTTPException(
            status_code=400,
            detail="Le code erreur est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                INSERT INTO code_erreur (
                    code,
                    type_defauts_id
                )
                VALUES (
                    :code,
                    :type_defauts_id
                )
                RETURNING
                    id,
                    code,
                    type_defauts_id
            """),
            {
                "code": code,
                "type_defauts_id": id,
            },
        )

        code_erreur = result.mappings().first()
        db.commit()

        return {
            "message": "Code erreur ajouté",
            "code_erreur": dict(code_erreur),
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible d'ajouter le code erreur "
                "ou type de défaut invalide"
            ),
        )


@router.put("/codes-erreur/{id}")
def modifier_code_erreur(
    id: int,
    data: CodeErreurPayload,
    db: Session = Depends(get_db),
):
    code = data.code.strip()

    if not code:
        raise HTTPException(
            status_code=400,
            detail="Le code erreur est obligatoire",
        )

    try:
        result = db.execute(
            text("""
                UPDATE code_erreur
                SET code = :code
                WHERE id = :id
                RETURNING
                    id,
                    code,
                    type_defauts_id
            """),
            {
                "id": id,
                "code": code,
            },
        )

        code_erreur = result.mappings().first()

        if not code_erreur:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail="Code erreur introuvable",
            )

        db.commit()

        return {
            "message": "Code erreur modifié",
            "code_erreur": dict(code_erreur),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de modifier le code erreur",
        )


@router.delete("/codes-erreur/{id}")
def supprimer_code_erreur(
    id: int,
    db: Session = Depends(get_db),
):
    try:
        result = db.execute(
            text("""
                DELETE FROM code_erreur
                WHERE id = :id
                RETURNING
                    id,
                    code,
                    type_defauts_id
            """),
            {"id": id},
        )

        code_erreur = result.mappings().first()

        if not code_erreur:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail="Code erreur introuvable",
            )

        db.commit()

        return {
            "message": "Code erreur supprimé",
            "code_erreur": dict(code_erreur),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer le code erreur",
        )