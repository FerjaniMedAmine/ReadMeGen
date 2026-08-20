from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from schemas.sessions_controle import (
    SessionControleCreate,
    SessionControleCloture,
)


router = APIRouter(
    prefix="/sessions-controle",
    tags=["Sessions de contrôle"],
)


@router.get("")
def get_sessions_controle(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(text("""
        SELECT
            sc.id,
            sc.numero_of,
            sc.created_at,
            sc.controleur_id,
            sc.operateur_id,
            sc.ilot_id,
            sc.poste_detection_id,
            sc.quantite_controlee,

            ofab.reference_produit,
            ofab.quantite AS quantite_of,
            ofab.site_id,

            u.username AS controleur_label,
            il.name AS ilot_label,
            pd.name AS poste_label,

            (
                SELECT COUNT(*)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS nombre_lignes_defauts,

            (
                SELECT COALESCE(SUM(dd.coefficient), 0)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS total_defauts,

            (
                SELECT COUNT(DISTINCT dd.numero_produit)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS nombre_produits_defectueux

        FROM sessions_controle sc

        JOIN ordres_fabrication ofab
            ON ofab.numero_of = sc.numero_of

        LEFT JOIN users u
            ON u.id = sc.controleur_id

        LEFT JOIN ilots il
            ON il.id = sc.ilot_id

        LEFT JOIN postes_detection pd
            ON pd.id = sc.poste_detection_id

        ORDER BY sc.created_at DESC
    """))

    return [
        dict(row)
        for row in result.mappings().all()
    ]


@router.get("/{session_id}")
def get_session_controle(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(text("""
        SELECT
            sc.id,
            sc.numero_of,
            sc.created_at,
            sc.controleur_id,
            sc.operateur_id,
            sc.ilot_id,
            sc.poste_detection_id,
            sc.quantite_controlee,

            ofab.reference_produit,
            ofab.quantite AS quantite_of,
            ofab.site_id,

            u.username AS controleur_label,
            il.name AS ilot_label,
            pd.name AS poste_label,

            (
                SELECT COUNT(*)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS nombre_lignes_defauts,

            (
                SELECT COALESCE(SUM(dd.coefficient), 0)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS total_defauts,

            (
                SELECT COUNT(DISTINCT dd.numero_produit)
                FROM defauts_detectes dd
                WHERE dd.session_id = sc.id
            ) AS nombre_produits_defectueux

        FROM sessions_controle sc

        JOIN ordres_fabrication ofab
            ON ofab.numero_of = sc.numero_of

        LEFT JOIN users u
            ON u.id = sc.controleur_id

        LEFT JOIN ilots il
            ON il.id = sc.ilot_id

        LEFT JOIN postes_detection pd
            ON pd.id = sc.poste_detection_id

        WHERE sc.id = :session_id
    """), {
        "session_id": session_id,
    })

    session_controle = result.mappings().first()

    if not session_controle:
        raise HTTPException(
            status_code=404,
            detail="Session de contrôle introuvable",
        )

    return dict(session_controle)


@router.post("")
def ajouter_session_controle(
    data: SessionControleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if data.operateur_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Matricule opérateur invalide",
        )

    ordre = db.execute(text("""
        SELECT
            numero_of,
            reference_produit,
            quantite,
            site_id
        FROM ordres_fabrication
        WHERE numero_of = :numero_of
    """), {
        "numero_of": data.numero_of,
    }).mappings().first()

    if not ordre:
        raise HTTPException(
            status_code=404,
            detail="Ordre de fabrication introuvable",
        )

    poste = db.execute(text("""
        SELECT
            id,
            ilots_id
        FROM postes_detection
        WHERE id = :poste_detection_id
    """), {
        "poste_detection_id": data.poste_detection_id,
    }).mappings().first()

    if not poste:
        raise HTTPException(
            status_code=404,
            detail="Poste de contrôle introuvable",
        )

    if poste["ilots_id"] != data.ilot_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Le poste de contrôle sélectionné "
                "n'appartient pas à l'îlot sélectionné"
            ),
        )

    try:
        result = db.execute(text("""
            INSERT INTO sessions_controle (
                numero_of,
                controleur_id,
                operateur_id,
                ilot_id,
                poste_detection_id
            )
            VALUES (
                :numero_of,
                :controleur_id,
                :operateur_id,
                :ilot_id,
                :poste_detection_id
            )
            RETURNING
                id,
                numero_of,
                created_at,
                controleur_id,
                operateur_id,
                ilot_id,
                poste_detection_id,
                quantite_controlee
        """), {
            "numero_of": data.numero_of,
            "controleur_id": current_user["id"],
            "operateur_id": data.operateur_id,
            "ilot_id": data.ilot_id,
            "poste_detection_id": data.poste_detection_id,
        })

        session_controle = result.mappings().first()

        db.commit()

        return {
            "message": "Session de contrôle créée",
            "session": dict(session_controle),
        }

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Erreur lors de la création de la session",
        )


@router.patch("/{session_id}/cloture")
def cloturer_session_controle(
    session_id: int,
    data: SessionControleCloture,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if data.quantite_controlee < 0:
        raise HTTPException(
            status_code=400,
            detail="La quantité contrôlée ne peut pas être négative",
        )

    session_controle = db.execute(text("""
        SELECT
            sc.id,
            sc.numero_of,
            sc.controleur_id,
            sc.quantite_controlee,
            ofab.quantite AS quantite_of
        FROM sessions_controle sc
        JOIN ordres_fabrication ofab
            ON ofab.numero_of = sc.numero_of
        WHERE sc.id = :session_id
    """), {
        "session_id": session_id,
    }).mappings().first()

    if not session_controle:
        raise HTTPException(
            status_code=404,
            detail="Session de contrôle introuvable",
        )

    if session_controle["controleur_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Cette session appartient à un autre contrôleur",
        )

    if session_controle["quantite_controlee"] is not None:
        raise HTTPException(
            status_code=400,
            detail="Cette session est déjà terminée",
        )

    nombre_produits_defectueux = db.execute(text("""
        SELECT COUNT(DISTINCT numero_produit)
        FROM defauts_detectes
        WHERE session_id = :session_id
    """), {
        "session_id": session_id,
    }).scalar() or 0

    if data.quantite_controlee < nombre_produits_defectueux:
        raise HTTPException(
            status_code=400,
            detail=(
                "La quantité contrôlée ne peut pas être inférieure "
                "au nombre de produits défectueux "
                f"({nombre_produits_defectueux})."
            ),
        )

    if data.quantite_controlee > session_controle["quantite_of"]:
        raise HTTPException(
            status_code=400,
            detail=(
                "La quantité contrôlée ne peut pas être supérieure "
                f"à la quantité totale de l'OF "
                f"({session_controle['quantite_of']})."
            ),
        )

    try:
        result = db.execute(text("""
            UPDATE sessions_controle
            SET quantite_controlee = :quantite_controlee
            WHERE id = :session_id
              AND quantite_controlee IS NULL
            RETURNING
                id,
                numero_of,
                created_at,
                controleur_id,
                operateur_id,
                ilot_id,
                poste_detection_id,
                quantite_controlee
        """), {
            "session_id": session_id,
            "quantite_controlee": data.quantite_controlee,
        })

        session_updated = result.mappings().first()

        if not session_updated:
            db.rollback()

            raise HTTPException(
                status_code=400,
                detail="La session a déjà été terminée",
            )

        db.commit()

        return {
            "message": "Session de contrôle terminée",
            "session": dict(session_updated),
            "nombre_produits_defectueux": (
                nombre_produits_defectueux
            ),
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=(
                "Erreur lors de l'enregistrement "
                "de la quantité contrôlée"
            ),
        )