from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db, require_admin
from schemas.clients import ClientCreate, ClientUpdate


router = APIRouter(
    prefix="/clients",
    tags=["Clients"],
)


@router.get("")
def get_clients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Accessible à tous les utilisateurs authentifiés.
    """
    result = db.execute(
        text("""
            SELECT id, nom
            FROM clients
            ORDER BY nom
        """)
    )

    return [dict(row) for row in result.mappings().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def ajouter_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    Accessible uniquement aux administrateurs.
    """
    nom = data.nom.strip()

    if not nom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom client obligatoire",
        )

    try:
        result = db.execute(
            text("""
                INSERT INTO clients (nom)
                VALUES (:nom)
                RETURNING id, nom, date_creation
            """),
            {"nom": nom},
        )

        client = result.mappings().first()
        db.commit()

        return {
            "message": "Client ajouté",
            "client": dict(client),
        }

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un client avec ce nom existe déjà",
        )

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'ajout du client",
        )


@router.put("/{id}")
def modifier_client(
    id: int,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    Accessible uniquement aux administrateurs.
    """
    nom = data.nom.strip()

    if not nom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom client obligatoire",
        )

    try:
        result = db.execute(
            text("""
                UPDATE clients
                SET nom = :nom
                WHERE id = :id
                RETURNING id, nom, date_creation
            """),
            {
                "id": id,
                "nom": nom,
            },
        )

        client = result.mappings().first()

        if not client:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client introuvable",
            )

        db.commit()

        return {
            "message": "Client modifié",
            "client": dict(client),
        }

    except HTTPException:
        raise

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un client avec ce nom existe déjà",
        )

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la modification du client",
        )


@router.delete("/{id}")
def supprimer_client(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    Accessible uniquement aux administrateurs.
    """
    try:
        result = db.execute(
            text("""
                DELETE FROM clients
                WHERE id = :id
                RETURNING id, nom
            """),
            {"id": id},
        )

        client = result.mappings().first()

        if not client:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client introuvable",
            )

        db.commit()

        return {
            "message": "Client supprimé",
            "client": dict(client),
        }

    except HTTPException:
        raise

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Impossible de supprimer ce client car il est utilisé "
                "par d'autres données"
            ),
        )

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la suppression du client",
        )