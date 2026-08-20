from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from dependencies import get_current_user, get_db, require_admin
from schemas.guide import (GuideLignePayload,GuideImportPayload)


router = APIRouter(
    tags=["Guide"]
)


@router.get("/guide/lookup")
def lookup_guide(
    carte_reference: str,
    machine_nom: str,
    composant_reference: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = db.execute(text("""
        SELECT
            guide_ligne.numero_slot,
            guide_ligne.position,
            guide_ligne.face,
            guide_ligne.quantite
        FROM guide_ligne
        JOIN machine ON machine.id = guide_ligne.machine_id
        WHERE guide_ligne.reference_carte = :carte_reference
          AND machine.nom = :machine_nom
          AND guide_ligne.reference_composant = :composant_reference
        LIMIT 1
    """), {
        "carte_reference": carte_reference,
        "machine_nom": machine_nom,
        "composant_reference": composant_reference
    })

    ligne = result.mappings().first()

    if ligne:
        return {
            "found": True,
            "slot_numero": ligne["numero_slot"],
            "position": ligne["position"],
            "face": ligne["face"],
            "quantite": ligne["quantite"]
        }

    return {
        "found": False,
        "message": "Composant non trouvé dans le guide de chargement"
    }


@router.get("/guide-carte")
def get_guide_carte(
    reference: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = db.execute(text("""
        SELECT
            guide_ligne.id,
            guide_ligne.reference_carte AS carte_reference,
            machine.nom AS machine_nom,
            guide_ligne.reference_composant AS composant_reference,
            guide_ligne.numero_slot AS slot_numero,
            guide_ligne.position,
            guide_ligne.face,
            guide_ligne.quantite
        FROM guide_ligne
        JOIN machine ON machine.id = guide_ligne.machine_id
        WHERE guide_ligne.reference_carte = :reference
        ORDER BY guide_ligne.face, machine.nom, guide_ligne.numero_slot, guide_ligne.position
    """), {
        "reference": reference
    })

    lignes = [dict(row) for row in result.mappings().all()]
    return lignes


def _get_machine_id(db: Session, machine_nom: str) -> int:
    machine = db.execute(text("""
        SELECT id FROM machine WHERE nom = :nom
    """), {"nom": machine_nom}).mappings().first()

    if not machine:
        raise HTTPException(status_code=400, detail="Machine introuvable")

    return machine["id"]


@router.post("/guide-carte")
def ajouter_ligne_guide(
    reference: str,
    data: GuideLignePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    try:
        machine_nom = data.machine_nom.strip()
        composant_reference = data.composant_reference.strip()

        if not machine_nom or not composant_reference:
            raise HTTPException(
                status_code=400,
                detail="Machine et composant obligatoires"
            )

        machine_id = _get_machine_id(db, machine_nom)

        result = db.execute(text("""
            INSERT INTO guide_ligne (
                reference_carte,
                machine_id,
                reference_composant,
                numero_slot,
                position,
                face,
                quantite
            )
            VALUES (
                :carte_reference,
                :machine_id,
                :composant_reference,
                :slot_numero,
                :position,
                :face,
                :quantite
            )
            RETURNING
                id,
                reference_carte AS carte_reference,
                reference_composant AS composant_reference,
                numero_slot AS slot_numero,
                position,
                face,
                quantite
        """), {
            "carte_reference": reference,
            "machine_id": machine_id,
            "composant_reference": composant_reference,
            "slot_numero": data.slot_numero,
            "position": data.position,
            "face": data.face,
            "quantite": data.quantite
        })

        ligne = dict(result.mappings().first())
        ligne["machine_nom"] = machine_nom
        db.commit()

        return {
            "message": "Ligne guide ajoutée",
            "ligne": ligne
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Erreur lors de l'ajout de la ligne guide (slot/position/face déjà utilisés ?)"
        )


@router.put("/guide/{id}")
def modifier_ligne_guide(
    id: int,
    data: GuideLignePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    try:
        machine_nom = data.machine_nom.strip()
        composant_reference = data.composant_reference.strip()

        if not machine_nom or not composant_reference:
            raise HTTPException(
                status_code=400,
                detail="Machine et composant obligatoires"
            )

        machine_id = _get_machine_id(db, machine_nom)

        result = db.execute(text("""
            UPDATE guide_ligne
            SET machine_id = :machine_id,
                reference_composant = :composant_reference,
                numero_slot = :slot_numero,
                position = :position,
                face = :face,
                quantite = :quantite
            WHERE id = :id
            RETURNING
                id,
                reference_carte AS carte_reference,
                reference_composant AS composant_reference,
                numero_slot AS slot_numero,
                position,
                face,
                quantite
        """), {
            "id": id,
            "machine_id": machine_id,
            "composant_reference": composant_reference,
            "slot_numero": data.slot_numero,
            "position": data.position,
            "face": data.face,
            "quantite": data.quantite
        })

        ligne = result.mappings().first()

        if not ligne:
            db.rollback()
            raise HTTPException(status_code=404, detail="Ligne guide introuvable")

        ligne = dict(ligne)
        ligne["machine_nom"] = machine_nom
        db.commit()

        return {
            "message": "Ligne guide modifiée",
            "ligne": ligne
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Erreur lors de la modification de la ligne guide"
        )


@router.delete("/guide/{id}")
def supprimer_ligne_guide(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    result = db.execute(text("""
        DELETE FROM guide_ligne
        WHERE id = :id
        RETURNING id
    """), {
        "id": id
    })

    ligne = result.mappings().first()

    if not ligne:
        db.rollback()
        raise HTTPException(status_code=404, detail="Ligne guide introuvable")

    db.commit()

    return {
        "message": "Ligne guide supprimée",
        "id": ligne["id"]
    }


@router.post("/guide-carte/import")
def import_guide(
    reference: str,
    data: GuideImportPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    try:

        for ligne in data.lignes:

            machine_id = _get_machine_id(
                db,
                ligne.machine_nom.strip()
            )

            db.execute(
                text("""
                    INSERT INTO guide_ligne (
                        reference_carte,
                        machine_id,
                        reference_composant,
                        numero_slot,
                        position,
                        face,
                        quantite
                    )
                    VALUES (
                        :reference_carte,
                        :machine_id,
                        :reference_composant,
                        :numero_slot,
                        :position,
                        :face,
                        :quantite
                    )
                """),
                {
                    "reference_carte": reference,
                    "machine_id": machine_id,
                    "reference_composant": ligne.composant_reference.strip(),
                    "numero_slot": ligne.slot_numero,
                    "position": ligne.position,
                    "face": ligne.face,
                    "quantite": ligne.quantite,
                },
            )

        db.commit()

        return {
            "message": f"{len(data.lignes)} lignes importées"
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=f"Erreur import: {str(e)}"
        )