from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db, require_admin
from schemas.historique import HistoriquePayload


router = APIRouter(prefix="/historique", tags=["Historique"])


def get_etat_actuel_query() -> str:
    return """
        WITH dernier_etat AS (
            SELECT
                id,
                date,
                type_operation,
                site,
                client,
                conducteur,
                machine,
                reference_carte,
                reference_bobine,
                reference_feeder,
                numero_slot,
                position_feeder,
                face,
                commentaire,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        site,
                        client,
                        machine,
                        reference_carte,
                        reference_feeder
                    ORDER BY date DESC, id DESC
                ) AS ordre
            FROM public.historique
            WHERE date >= CURRENT_DATE
              AND date < CURRENT_DATE + INTERVAL '1 day'
        )
    """


def suivi_existe_pour_contexte(
    db: Session, site: str, client: str, machine: str, reference_carte: str
) -> bool:
    result = db.execute(
        text("""
        SELECT EXISTS (
            SELECT 1
            FROM public.historique
            WHERE type_operation = 'suivi_plan_chargement'
              AND site = :site
              AND client = :client
              AND machine = :machine
              AND reference_carte = :reference_carte
              AND date >= CURRENT_DATE
              AND date < CURRENT_DATE + INTERVAL '1 day'
        )
    """),
        {
            "site": site.strip(),
            "client": client.strip(),
            "machine": machine.strip(),
            "reference_carte": reference_carte.strip(),
        },
    )

    return bool(result.scalar())


def verifier_suivi_pour_contexte(
    db: Session, site: str, client: str, machine: str, reference_carte: str
) -> None:
    if not suivi_existe_pour_contexte(db, site, client, machine, reference_carte):
        raise HTTPException(
            status_code=403,
            detail=(
                "Aucun suivi n’a été effectué aujourd’hui pour "
                "ce site, ce client, cette machine et cette référence carte."
            ),
        )


@router.post("")
def ajouter_historique(
    data: HistoriquePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if data.type_operation in ("reordonnancement", "raboutage_rechargement"):
        verifier_suivi_pour_contexte(
            db, data.site, data.client, data.machine, data.reference_carte
        )

    try:
        result = db.execute(
            text("""
            INSERT INTO public.historique (
                type_operation,
                site,
                client,
                conducteur,
                machine,
                reference_carte,
                reference_bobine,
                reference_feeder,
                numero_slot,
                position_feeder,
                face,
                commentaire
            )
            VALUES (
                :type_operation,
                :site,
                :client,
                :conducteur,
                :machine,
                :reference_carte,
                :reference_bobine,
                :reference_feeder,
                :numero_slot,
                :position_feeder,
                :face,
                :commentaire
            )
            RETURNING
                id,
                date,
                type_operation,
                site,
                client,
                conducteur,
                machine,
                reference_carte,
                reference_bobine,
                reference_feeder,
                numero_slot,
                position_feeder,
                face,
                commentaire
        """),
            {
                "type_operation": data.type_operation,
                "site": data.site.strip(),
                "client": data.client.strip(),
                "conducteur": data.conducteur.strip(),
                "machine": data.machine.strip(),
                "reference_carte": data.reference_carte.strip(),
                "reference_bobine": data.reference_bobine.strip(),
                "reference_feeder": data.reference_feeder.strip(),
                "numero_slot": data.numero_slot,
                "position_feeder": data.position_feeder,
                "face": data.face,
                "commentaire": data.commentaire,
            },
        )

        historique = result.mappings().first()
        db.commit()

        return {"message": "Historique ajouté", "historique": dict(historique)}

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400, detail="Erreur lors de l'ajout dans l'historique"
        )


@router.get("/contexte-aujourdhui")
def get_contexte_aujourdhui(
    site: str,
    client: str,
    machine: str,
    reference_carte: str,
    type_operation: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    site = site.strip()
    client = client.strip()
    machine = machine.strip()
    reference_carte = reference_carte.strip()

    if not site or not client or not machine or not reference_carte:
        raise HTTPException(
            status_code=400,
            detail=(
                "Le site, le client, la machine et la référence carte sont obligatoires"
            ),
        )

    query = """
        SELECT
            id,
            date,
            type_operation,
            site,
            client,
            conducteur,
            machine,
            reference_carte,
            reference_bobine,
            reference_feeder,
            numero_slot,
            position_feeder,
            face,
            commentaire
        FROM public.historique
        WHERE site = :site
          AND client = :client
          AND machine = :machine
          AND reference_carte = :reference_carte
          AND date >= CURRENT_DATE
          AND date < CURRENT_DATE + INTERVAL '1 day'
    """

    params = {
        "site": site,
        "client": client,
        "machine": machine,
        "reference_carte": reference_carte,
    }

    if (
        type_operation
        and type_operation != "suivi_plan_chargement"
    ):
        query += """
          AND type_operation = :type_operation
        """
        params["type_operation"] = type_operation

    query += """
        ORDER BY date DESC, id DESC
    """

    result = db.execute(
        text(query),
        params,
    )

    lignes = [dict(row) for row in result.mappings().all()]

    suivi_result = db.execute(
        text("""
            SELECT 1
            FROM public.historique
            WHERE site = :site
              AND client = :client
              AND machine = :machine
              AND reference_carte = :reference_carte
              AND type_operation = 'suivi_plan_chargement'
              AND date >= CURRENT_DATE
              AND date < CURRENT_DATE + INTERVAL '1 day'
            LIMIT 1
        """),
        {
            "site": site,
            "client": client,
            "machine": machine,
            "reference_carte": reference_carte,
        },
    )

    suivi_existe = suivi_result.first() is not None

    return {
        "suivi_existe": suivi_existe,
        "nombre_lignes": len(lignes),
        "lignes": lignes,
    }
@router.get("/dernier-enregistrement")
def get_dernier_enregistrement(
    site: str,
    client: str,
    machine: str,
    reference_carte: str,
    reference_bobine: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    site = site.strip()
    client = client.strip()
    machine = machine.strip()
    reference_carte = reference_carte.strip()
    reference_bobine = reference_bobine.strip()

    if (
        not site
        or not client
        or not machine
        or not reference_carte
        or not reference_bobine
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Le contexte de travail et la référence "
                "de l’ancienne bobine sont obligatoires"
            ),
        )

    verifier_suivi_pour_contexte(db, site, client, machine, reference_carte)

    base_query = get_etat_actuel_query()

    result = db.execute(
        text(
            base_query
            + """
        SELECT
            id,
            date,
            type_operation,
            site,
            client,
            conducteur,
            machine,
            reference_carte,
            reference_bobine,
            reference_feeder,
            numero_slot,
            position_feeder,
            face,
            commentaire
        FROM dernier_etat
        WHERE ordre = 1
          AND site = :site
          AND client = :client
          AND machine = :machine
          AND reference_carte = :reference_carte
          AND reference_bobine = :reference_bobine
        ORDER BY date DESC, id DESC
        LIMIT 1
        """
        ),
        {
            "site": site,
            "client": client,
            "machine": machine,
            "reference_carte": reference_carte,
            "reference_bobine": reference_bobine,
        },
    )

    historique = result.mappings().first()

    if not historique:
        raise HTTPException(
            status_code=404,
            detail=(
                "Aucune position actuelle trouvée aujourd’hui "
                "pour cette bobine dans le contexte sélectionné."
            ),
        )

    return dict(historique)


@router.get("")
def get_historique(
    db: Session = Depends(get_db), current_user: dict = Depends(require_admin)
):
    result = db.execute(
        text("""
        SELECT
            id,
            date,
            type_operation,
            site,
            client,
            conducteur,
            machine,
            reference_carte,
            reference_bobine,
            reference_feeder,
            numero_slot,
            position_feeder,
            face,
            commentaire
        FROM public.historique
        ORDER BY date DESC, id DESC
    """)
    )

    return [dict(row) for row in result.mappings().all()]
