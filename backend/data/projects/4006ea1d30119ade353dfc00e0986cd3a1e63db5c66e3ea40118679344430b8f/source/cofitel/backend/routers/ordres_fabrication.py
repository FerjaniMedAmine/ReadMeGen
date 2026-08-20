from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_db, get_current_user, require_admin
from schemas.ordres_fabrication import OrdreFabricationCreate, OrdreFabricationUpdate


router = APIRouter(
    prefix="/ordres-fabrication",
    tags=["Ordres de fabrication"]
)


@router.get("")
def get_ordres_fabrication(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = db.execute(text("""
        SELECT numero_of, reference_produit, quantite, site_id, created_at
        FROM ordres_fabrication
        ORDER BY created_at DESC
    """))

    ordres = [dict(row) for row in result.mappings().all()]
    return ordres


@router.get("/{numero_of}")
def get_ordre_fabrication(
    numero_of: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = db.execute(text("""
        SELECT numero_of, reference_produit, quantite, site_id, created_at
        FROM ordres_fabrication
        WHERE numero_of = :numero_of
    """), {
        "numero_of": numero_of
    })

    ordre = result.mappings().first()

    if not ordre:
        raise HTTPException(
            status_code=404,
            detail="Ordre de fabrication introuvable"
        )

    return dict(ordre)


@router.post("")
def ajouter_ordre_fabrication(
    data: OrdreFabricationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    reference_produit = data.reference_produit.strip()

    if not reference_produit:
        raise HTTPException(
            status_code=400,
            detail="Référence produit obligatoire"
        )

    try:
        result = db.execute(text("""
            INSERT INTO ordres_fabrication (
                numero_of,
                reference_produit,
                quantite,
                site_id
            )
            VALUES (
                :numero_of,
                :reference_produit,
                :quantite,
                :site_id
            )
            RETURNING
                numero_of,
                reference_produit,
                quantite,
                site_id,
                created_at
        """), {
            "numero_of": data.numero_of,
            "reference_produit": reference_produit,
            "quantite": data.quantite,
            "site_id": data.site_id
        })

        ordre = result.mappings().first()
        db.commit()

        return {
            "message": "Ordre de fabrication ajouté",
            "ordre": dict(ordre)
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Numéro d'OF déjà existant ou erreur d'ajout"
        )


@router.put("/{numero_of}")
def modifier_ordre_fabrication(
    numero_of: int,
    data: OrdreFabricationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    reference_produit = data.reference_produit.strip()

    if not reference_produit:
        raise HTTPException(
            status_code=400,
            detail="Référence produit obligatoire"
        )

    result = db.execute(text("""
        UPDATE ordres_fabrication
        SET reference_produit = :reference_produit,
            quantite = :quantite,
            site_id = :site_id
        WHERE numero_of = :numero_of
        RETURNING numero_of, reference_produit, quantite, site_id, created_at
    """), {
        "numero_of": numero_of,
        "reference_produit": reference_produit,
        "quantite": data.quantite,
        "site_id": data.site_id
    })

    ordre = result.mappings().first()

    if not ordre:
        db.rollback()

        raise HTTPException(
            status_code=404,
            detail="Ordre de fabrication introuvable"
        )

    db.commit()

    return {
        "message": "Ordre de fabrication modifié",
        "ordre": dict(ordre)
    }