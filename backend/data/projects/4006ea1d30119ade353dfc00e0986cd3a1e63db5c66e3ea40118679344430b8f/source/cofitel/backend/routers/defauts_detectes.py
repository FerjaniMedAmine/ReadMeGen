from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from schemas.defauts_detectes import DefautDetecteCreate


router = APIRouter(
    prefix="/defauts-detectes",
    tags=["Défauts détectés"],
)


def _build_filters(
    session_id: Optional[int],
    numero_of: Optional[int],
    reference_produit: Optional[str],
):
    clauses = []
    params = {}

    if session_id is not None:
        clauses.append("dd.session_id = :session_id")
        params["session_id"] = session_id

    if numero_of is not None:
        clauses.append("sc.numero_of = :numero_of")
        params["numero_of"] = numero_of

    if reference_produit:
        clauses.append("ofab.reference_produit = :reference_produit")
        params["reference_produit"] = reference_produit

    where_sql = "WHERE " + " AND ".join(clauses) if clauses else ""

    return where_sql, params


@router.get("")
def get_defauts_detectes(
    session_id: Optional[int] = None,
    numero_of: Optional[int] = None,
    reference_produit: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    where_sql, params = _build_filters(
        session_id,
        numero_of,
        reference_produit,
    )

    result = db.execute(
        text(f"""
        SELECT
            dd.id,
            dd.session_id,
            dd.created_at,
            dd.code_erreur_id,
            dd.repere_topo,
            dd.coefficient,
            dd.observation,
            dd.numero_produit,

            sc.numero_of,
            sc.controleur_id,
            sc.operateur_id,
            sc.quantite_controlee,

            ofab.reference_produit,
            ofab.quantite AS quantite_of,
            ofab.site_id,

            ce.code AS code_defaut_label,
            td.name AS type_defaut_label,
            pd.name AS poste_label,
            il.name AS ilot_label,
            u.username AS controleur_label

        FROM defauts_detectes dd

        JOIN sessions_controle sc
            ON sc.id = dd.session_id

        JOIN ordres_fabrication ofab
            ON ofab.numero_of = sc.numero_of

        LEFT JOIN code_erreur ce
            ON ce.id = dd.code_erreur_id

        LEFT JOIN type_defauts td
            ON td.id = ce.type_defauts_id

        LEFT JOIN postes_detection pd
            ON pd.id = td.postes_detection_id

        LEFT JOIN ilots il
            ON il.id = pd.ilots_id

        LEFT JOIN users u
            ON u.id = sc.controleur_id

        {where_sql}

        ORDER BY dd.created_at DESC
    """),
        params,
    )

    return [dict(row) for row in result.mappings().all()]


@router.get("/stats")
def get_defauts_detectes_stats(
    session_id: Optional[int] = None,
    numero_of: Optional[int] = None,
    reference_produit: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    where_sql, params = _build_filters(
        session_id,
        numero_of,
        reference_produit,
    )

    joined_base = """
        FROM defauts_detectes dd
        JOIN sessions_controle sc
            ON sc.id = dd.session_id
        JOIN ordres_fabrication ofab
            ON ofab.numero_of = sc.numero_of
    """

    # KPIs
    kpis_row = (
        db.execute(
            text(f"""
        SELECT
            COUNT(*) AS total_defauts,
            COUNT(DISTINCT sc.numero_of) AS of_concernes,
            COALESCE(AVG(dd.coefficient), 0) AS coefficient_moyen
        {joined_base}
        {where_sql}
    """),
            params,
        )
        .mappings()
        .first()
    )

    kpis = {
        "total_defauts": int(kpis_row["total_defauts"] or 0),
        "of_concernes": int(kpis_row["of_concernes"] or 0),
        "coefficient_moyen": round(
            float(kpis_row["coefficient_moyen"] or 0),
            2,
        ),
    }

    # Pareto par code défaut
    pareto_rows = (
        db.execute(
            text(f"""
        WITH counts AS (
            SELECT
                COALESCE(ce.code, 'N/A') AS code,
                COUNT(*) AS count
            {joined_base}
            LEFT JOIN code_erreur ce
                ON ce.id = dd.code_erreur_id
            {where_sql}
            GROUP BY ce.code
        ),
        ranked AS (
            SELECT
                code,
                count,
                SUM(count) OVER (
                    ORDER BY count DESC, code
                ) AS running_total,
                SUM(count) OVER () AS total
            FROM counts
        )
        SELECT
            code,
            count,
            ROUND(
                100.0 * running_total / NULLIF(total, 0),
                1
            ) AS cumul_pct
        FROM ranked
        ORDER BY count DESC, code
        LIMIT 12
    """),
            params,
        )
        .mappings()
        .all()
    )

    pareto = [
        {
            "code": row["code"],
            "count": int(row["count"]),
            "cumul_pct": float(row["cumul_pct"] or 0),
        }
        for row in pareto_rows
    ]

    # Répartition par type
    par_type_rows = (
        db.execute(
            text(f"""
        SELECT
            COALESCE(td.name, 'N/A') AS type,
            COUNT(*) AS count
        {joined_base}
        LEFT JOIN code_erreur ce
            ON ce.id = dd.code_erreur_id
        LEFT JOIN type_defauts td
            ON td.id = ce.type_defauts_id
        {where_sql}
        GROUP BY td.name
        ORDER BY count DESC
    """),
            params,
        )
        .mappings()
        .all()
    )

    par_type = [
        {
            "type": row["type"],
            "count": int(row["count"]),
        }
        for row in par_type_rows
    ]

    # Évolution quotidienne
    par_jour_rows = (
        db.execute(
            text(f"""
        SELECT
            TO_CHAR(dd.created_at::date, 'YYYY-MM-DD') AS date,
            COUNT(*) AS count
        {joined_base}
        {where_sql}
        GROUP BY dd.created_at::date
        ORDER BY dd.created_at::date
    """),
            params,
        )
        .mappings()
        .all()
    )

    par_jour = [
        {
            "date": row["date"],
            "count": int(row["count"]),
        }
        for row in par_jour_rows
    ]

    # Défauts par poste
    par_poste_rows = (
        db.execute(
            text(f"""
        SELECT
            COALESCE(pd.name, 'N/A') AS poste,
            COUNT(*) AS count
        {joined_base}
        LEFT JOIN code_erreur ce
            ON ce.id = dd.code_erreur_id
        LEFT JOIN type_defauts td
            ON td.id = ce.type_defauts_id
        LEFT JOIN postes_detection pd
            ON pd.id = td.postes_detection_id
        {where_sql}
        GROUP BY pd.name
        ORDER BY count DESC
    """),
            params,
        )
        .mappings()
        .all()
    )

    par_poste = [
        {
            "poste": row["poste"],
            "count": int(row["count"]),
        }
        for row in par_poste_rows
    ]

    # Top repères TOPO
    topo_rows = (
        db.execute(
            text(f"""
        SELECT
            COALESCE(dd.repere_topo, 'N/A') AS repere_topo,
            COUNT(*) AS count
        {joined_base}
        {where_sql}
        GROUP BY dd.repere_topo
        ORDER BY count DESC
        LIMIT 10
    """),
            params,
        )
        .mappings()
        .all()
    )

    topo_hotspots = [
        {
            "repere_topo": row["repere_topo"],
            "count": int(row["count"]),
        }
        for row in topo_rows
    ]

    # Seuil par OF et TOPO
    seuil_rows = (
        db.execute(
            text(f"""
        SELECT
            sc.numero_of,
            dd.repere_topo,
            ofab.reference_produit,
            COALESCE(SUM(dd.coefficient), 0) AS coefficient
        {joined_base}
        {where_sql}
        GROUP BY
            sc.numero_of,
            dd.repere_topo,
            ofab.reference_produit
        ORDER BY coefficient DESC
        LIMIT 10
    """),
            params,
        )
        .mappings()
        .all()
    )

    seuil_arret = [
        {
            "numero_of": row["numero_of"],
            "repere_topo": row["repere_topo"],
            "reference_produit": row["reference_produit"],
            "coefficient": int(row["coefficient"]),
        }
        for row in seuil_rows
    ]

    # Top produits
    top_produits_rows = (
        db.execute(
            text(f"""
        SELECT
            ofab.reference_produit,
            COUNT(*) AS count
        {joined_base}
        {where_sql}
        GROUP BY ofab.reference_produit
        ORDER BY count DESC
        LIMIT 10
    """),
            params,
        )
        .mappings()
        .all()
    )

    top_produits = [
        {
            "reference_produit": row["reference_produit"],
            "count": int(row["count"]),
        }
        for row in top_produits_rows
    ]

    return {
        "kpis": kpis,
        "pareto": pareto,
        "par_type": par_type,
        "par_jour": par_jour,
        "par_poste": par_poste,
        "topo_hotspots": topo_hotspots,
        "seuil_arret": seuil_arret,
        "top_produits": top_produits,
    }


@router.get("/{defaut_id}")
def get_defaut_detecte(
    defaut_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
        SELECT
            dd.id,
            dd.session_id,
            dd.created_at,
            dd.code_erreur_id,
            dd.repere_topo,
            dd.coefficient,
            dd.observation,
            dd.numero_produit,
            sc.numero_of,
            sc.controleur_id,
            sc.operateur_id
        FROM defauts_detectes dd
        JOIN sessions_controle sc
            ON sc.id = dd.session_id
        WHERE dd.id = :defaut_id
    """),
        {
            "defaut_id": defaut_id,
        },
    )

    defaut = result.mappings().first()

    if not defaut:
        raise HTTPException(
            status_code=404,
            detail="Défaut introuvable",
        )

    return dict(defaut)


@router.post("")
def ajouter_defaut_detecte(
    data: DefautDetecteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    repere_topo = data.repere_topo.strip()

    if not repere_topo:
        raise HTTPException(
            status_code=400,
            detail="Repère TOPO obligatoire",
        )

    if data.coefficient < 1:
        raise HTTPException(
            status_code=400,
            detail="Le coefficient doit être supérieur à 0",
        )

    if data.numero_produit < 1:
        raise HTTPException(
            status_code=400,
            detail="Le numéro de produit doit être supérieur à 0",
        )

    # Vérifier la session
    session_controle = db.execute(text("""
        SELECT
            id,
            controleur_id,
            poste_detection_id,
            quantite_controlee
        FROM sessions_controle
        WHERE id = :session_id
    """), {
        "session_id": data.session_id,
    }).mappings().first()

    if not session_controle:
        raise HTTPException(
            status_code=404,
            detail="Session de contrôle introuvable",
        )

    if session_controle["quantite_controlee"] is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cette session est déjà terminée. "
                "Aucun nouveau défaut ne peut être ajouté."
            ),
        )

    if session_controle["controleur_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Cette session appartient à un autre contrôleur",
        )

    # Vérifier que le code défaut appartient au poste de la session
    code_erreur = db.execute(text("""
        SELECT
            ce.id,
            ce.code,
            td.postes_detection_id
        FROM code_erreur ce
        JOIN type_defauts td
            ON td.id = ce.type_defauts_id
        WHERE ce.id = :code_erreur_id
    """), {
        "code_erreur_id": data.code_erreur_id,
    }).mappings().first()

    if not code_erreur:
        raise HTTPException(
            status_code=404,
            detail="Code défaut introuvable",
        )

    if (
        code_erreur["postes_detection_id"]
        != session_controle["poste_detection_id"]
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Le code défaut sélectionné n'appartient pas "
                "au poste de contrôle de cette session."
            ),
        )

    try:
        # Enregistrer le défaut
        result = db.execute(text("""
            INSERT INTO defauts_detectes (
                session_id,
                code_erreur_id,
                repere_topo,
                coefficient,
                observation,
                numero_produit
            )
            VALUES (
                :session_id,
                :code_erreur_id,
                :repere_topo,
                :coefficient,
                :observation,
                :numero_produit
            )
            RETURNING
                id,
                session_id,
                created_at,
                code_erreur_id,
                repere_topo,
                coefficient,
                observation,
                numero_produit
        """), {
            "session_id": data.session_id,
            "code_erreur_id": data.code_erreur_id,
            "repere_topo": repere_topo,
            "coefficient": data.coefficient,
            "observation": (
                data.observation.strip()
                if data.observation
                else None
            ),
            "numero_produit": data.numero_produit,
        })

        defaut = result.mappings().first()

        # Calculer les seuils après l'insertion
        seuil = db.execute(text("""
            SELECT
                COUNT(*) AS occurrences,
                COALESCE(SUM(coefficient), 0) AS coefficient_total
            FROM defauts_detectes
            WHERE session_id = :session_id
              AND code_erreur_id = :code_erreur_id
              AND UPPER(TRIM(repere_topo)) =
                  UPPER(TRIM(:repere_topo))
        """), {
            "session_id": data.session_id,
            "code_erreur_id": data.code_erreur_id,
            "repere_topo": repere_topo,
        }).mappings().first()

        occurrences = int(seuil["occurrences"] or 0)
        coefficient_total = int(
            seuil["coefficient_total"] or 0
        )

        alerts = []

        # Règle VBA : 7 répétitions ou plus
        if occurrences >= 7:
            alerts.append({
                "type": "REPETITION_DEFAUT",
                "niveau": "ARRET_PRODUCTION",
                "message": (
                    "Limite maximale de répétition atteinte. "
                    "Arrêt de production requis."
                ),
                "occurrences": occurrences,
                "code_defaut": code_erreur["code"],
                "repere_topo": repere_topo,
            })

        # Règle VBA : somme des coefficients >= 6
        if coefficient_total >= 6:
            alerts.append({
                "type": "COEFFICIENT_TOTAL",
                "niveau": "ARRET_PRODUCTION",
                "message": (
                    "La somme des coefficients a atteint "
                    "le seuil d'arrêt de production."
                ),
                "coefficient_total": coefficient_total,
                "seuil": 6,
                "code_defaut": code_erreur["code"],
                "repere_topo": repere_topo,
            })

        db.commit()

        return {
            "message": "Défaut enregistré",
            "defaut": dict(defaut),
            "alerts": alerts,
            "resume_seuil": {
                "occurrences": occurrences,
                "coefficient_total": coefficient_total,
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Erreur lors de l'enregistrement du défaut",
        )