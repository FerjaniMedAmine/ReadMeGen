from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_db, get_current_user, require_admin
from schemas.machines import MachineCreate, MachineUpdate


router = APIRouter(
    prefix="/machines",
    tags=["Machines"]
)


@router.get("")
def get_machines(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = db.execute(text("""
        SELECT nom
        FROM machine
        ORDER BY nom
    """))

    machines = [dict(row) for row in result.mappings().all()]
    return machines


@router.post("")
def ajouter_machine(data: MachineCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    nom = data.nom.strip()

    if not nom:
        raise HTTPException(status_code=400, detail="Nom machine obligatoire")

    try:
        db.execute(text("""
            INSERT INTO machine (nom)
            VALUES (:nom)
        """), {
            "nom": nom
        })

        db.commit()

        return {
            "message": "Machine ajoutée",
            "nom": nom
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Machine déjà existante ou erreur d'ajout"
        )


@router.put("/{nom}")
def modifier_machine(
    nom: str,
    data: MachineUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    nouveau_nom = data.nouveau_nom.strip()

    if not nouveau_nom:
        raise HTTPException(status_code=400, detail="Nouveau nom obligatoire")

    result = db.execute(text("""
        UPDATE machine
        SET nom = :nouveau_nom
        WHERE nom = :ancien_nom
        RETURNING nom
    """), {
        "nouveau_nom": nouveau_nom,
        "ancien_nom": nom
    })

    updated = result.mappings().first()

    if not updated:
        db.rollback()
        raise HTTPException(status_code=404, detail="Machine introuvable")

    db.commit()

    return {
        "message": "Machine modifiée",
        "ancien_nom": nom,
        "nouveau_nom": nouveau_nom
    }


@router.delete("/{nom}")
def supprimer_machine(nom: str, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = db.execute(text("""
        DELETE FROM machine
        WHERE nom = :nom
        RETURNING nom
    """), {
        "nom": nom
    })

    deleted = result.mappings().first()

    if not deleted:
        db.rollback()
        raise HTTPException(status_code=404, detail="Machine introuvable")

    db.commit()

    return {
        "message": "Machine supprimée",
        "nom": nom
    }