from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_current_user, get_db, require_admin
from schemas.cartes import CartePayload


router = APIRouter(tags=["Cartes"])


@router.get("/clients/{id}/cartes")
def get_cartes_client(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
        SELECT reference
        FROM cartes
        WHERE client_id = :id
        ORDER BY reference
    """),
        {"id": id},
    )

    cartes = [dict(row) for row in result.mappings().all()]
    return cartes


@router.post("/clients/{id}/cartes")
def ajouter_carte_client(
    id: int,
    data: CartePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    reference = data.reference.strip()

    if not reference:
        raise HTTPException(status_code=400, detail="Référence carte obligatoire")

    try:
        result = db.execute(
            text("""
            INSERT INTO cartes (reference, client_id)
            VALUES (:reference, :client_id)
            RETURNING reference
        """),
            {"reference": reference, "client_id": id},
        )

        carte = result.mappings().first()
        db.commit()

        return {"message": "Carte ajoutée", "carte": dict(carte)}

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Carte déjà existante ou client invalide"
        )


@router.get("/cartes/client")
def get_client_by_reference(
    reference: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
        SELECT
            clients.id,
            clients.nom
        FROM cartes
        JOIN clients ON cartes.client_id = clients.id
        WHERE cartes.reference = :reference
    """),
        {"reference": reference.strip()},
    )

    client = result.mappings().first()

    if not client:
        raise HTTPException(status_code=404, detail="Carte introuvable")

    return dict(client)


@router.delete("/cartes/{reference}")
def supprimer_carte(
    reference: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    result = db.execute(
        text("""
        DELETE FROM cartes
        WHERE reference = :reference
        RETURNING reference
    """),
        {"reference": reference},
    )

    carte = result.mappings().first()

    if not carte:
        db.rollback()
        raise HTTPException(status_code=404, detail="Carte introuvable")

    db.commit()

    return {"message": "Carte supprimée", "reference": carte["reference"]}


@router.get("/cartes/check")
def check_carte(
    reference: str,
    client: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
        SELECT cartes.reference, clients.nom AS client
        FROM cartes
        JOIN clients ON cartes.client_id = clients.id
        WHERE cartes.reference = :reference
        AND clients.nom = :client
    """),
        {"reference": reference, "client": client},
    )

    carte = result.mappings().first()

    if carte:
        return {
            "valid": True,
            "message": "Référence valide pour ce client",
            "carte": dict(carte),
        }

    return {"valid": False, "message": "Référence incorrecte pour ce client"}