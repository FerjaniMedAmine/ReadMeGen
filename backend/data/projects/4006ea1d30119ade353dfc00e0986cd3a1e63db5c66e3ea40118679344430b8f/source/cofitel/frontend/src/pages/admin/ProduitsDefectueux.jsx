import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getDefautsDetectes } from "../../services/defautsDetectesService";
import { getOrdresFabrication } from "../../services/ordresFabricationService";

import "../styles/admin/ProduitsDefectueux.css";

function normalizeApiArray(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.results)) {
        return response.results;
    }

    return [];
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

/**
 * The backend joins code_erreur -> type_defauts -> postes_detection -> ilots
 * and returns the ilot's name directly as `ilot_label`.
 */
function getIlotName(defaut) {
    return defaut?.ilot_label ?? "—";
}

/**
 * The backend joins code_erreur and returns its code directly as
 * `code_defaut_label`. Fall back to the raw id if the join produced
 * nothing (e.g. an orphaned code_erreur_id).
 */
function getErrorCode(defaut) {
    return (
        defaut?.code_defaut_label ??
        (defaut?.code_erreur_id ? `#${defaut.code_erreur_id}` : "—")
    );
}

/**
 * The backend joins users on controleur_id and returns the username
 * directly as `controleur_label`. There's no equivalent join for
 * operateur_id, since it's a plain matricule with no FK to users.
 */
function getControleurName(defaut) {
    return (
        defaut?.controleur_label ??
        (defaut?.controleur_id ? `#${defaut.controleur_id}` : "—")
    );
}

/**
 * Group a manufacturing order's defects by numero_produit, sorted so
 * the table reads in ascending produit order.
 */
function groupByNumeroProduit(defauts) {
    const groups = new Map();

    defauts.forEach((defaut) => {
        const key = defaut.numero_produit ?? "—";

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(defaut);
    });

    return Array.from(groups.entries()).sort((a, b) => {
        const numA = Number(a[0]);
        const numB = Number(b[0]);

        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
            return numA - numB;
        }

        return String(a[0]).localeCompare(String(b[0]));
    });
}
function groupBySession(defauts) {
    const sessions = new Map();

    defauts.forEach((defaut) => {
        const sessionId = defaut.session_id;
        const sessionKey = String(sessionId ?? "sans-session");

        if (!sessions.has(sessionKey)) {
            sessions.set(sessionKey, {
                id: sessionId,
                key: sessionKey,
                createdAt: defaut.created_at,
                controleurId: defaut.controleur_id,
                controleurLabel: getControleurName(defaut),
                operateurId: defaut.operateur_id,
                quantiteControlee: defaut.quantite_controlee,
                defauts: [],
            });
        }

        const session = sessions.get(sessionKey);

        session.defauts.push(defaut);

        const currentDate = new Date(session.createdAt);
        const defectDate = new Date(defaut.created_at);

        if (
            !Number.isNaN(defectDate.getTime()) &&
            (Number.isNaN(currentDate.getTime()) ||
                defectDate < currentDate)
        ) {
            session.createdAt = defaut.created_at;
        }
    });

    return Array.from(sessions.values())
        .map((session) => ({
            ...session,

            nombreDefauts: session.defauts.reduce(
                (total, defaut) =>
                    total + Number(defaut.coefficient ?? 1),
                0
            ),

            nombreProduitsDefectueux: new Set(
                session.defauts
                    .map((defaut) => defaut.numero_produit)
                    .filter(
                        (numeroProduit) =>
                            numeroProduit !== null &&
                            numeroProduit !== undefined
                    )
            ).size,
        }))
        .sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();

            return dateB - dateA;
        });
}

function ProduitsDefectueux() {
    const navigate = useNavigate();

    const [defauts, setDefauts] = useState([]);
    const [ordresFabrication, setOrdresFabrication] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [numeroOfFilter, setNumeroOfFilter] = useState("");
    const [expandedOrder, setExpandedOrder] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [defautsResponse, ordresResponse] = await Promise.all([
                getDefautsDetectes({}),
                getOrdresFabrication(),
            ]);

            setDefauts(normalizeApiArray(defautsResponse));
            setOrdresFabrication(normalizeApiArray(ordresResponse));
        } catch (err) {
            console.error(
                "Erreur lors du chargement des produits défectueux :",
                err
            );

            setError(
                err?.response?.data?.message ||
                "Impossible de charger les produits défectueux."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    /**
     * Index manufacturing orders by their number.
     */
    const ordreByNumero = useMemo(() => {
        return ordresFabrication.reduce((accumulator, ordre) => {
            accumulator[String(ordre.numero_of)] = ordre;
            return accumulator;
        }, {});
    }, [ordresFabrication]);

    /**
     * Group all detected defects by manufacturing order.
     *
     * The table will therefore contain one row per OF.
     */
    const ordresAvecDefauts = useMemo(() => {
        const groupedOrders = new Map();

        defauts.forEach((defaut) => {
            const numeroOf = defaut.numero_of;
            const orderKey = String(numeroOf);
            const ordre = ordreByNumero[orderKey];

            if (!groupedOrders.has(orderKey)) {
                groupedOrders.set(orderKey, {
                    key: orderKey,
                    numeroOf,
                    referenceProduit:
                        ordre?.reference_produit ?? "Référence inconnue",
                    quantite: ordre?.quantite ?? "—",
                    lastDetectedAt: defaut.created_at,
                    ilots: new Set(),
                    defauts: [],
                });
            }

            const groupedOrder = groupedOrders.get(orderKey);

            groupedOrder.defauts.push(defaut);

            const ilotName = getIlotName(defaut);

            if (ilotName && ilotName !== "—") {
                groupedOrder.ilots.add(ilotName);
            }

            const currentLastDate = new Date(groupedOrder.lastDetectedAt);
            const defectDate = new Date(defaut.created_at);

            if (
                !Number.isNaN(defectDate.getTime()) &&
                (Number.isNaN(currentLastDate.getTime()) ||
                    defectDate > currentLastDate)
            ) {
                groupedOrder.lastDetectedAt = defaut.created_at;
            }
        });

        return Array.from(groupedOrders.values())
            .map((ordre) => {
                const sessions = groupBySession(ordre.defauts);

                return {
                    ...ordre,
                    ilots: Array.from(ordre.ilots),
                    sessions,

                    nombreDefauts: ordre.defauts.reduce(
                        (sum, defaut) =>
                            sum + Number(defaut.coefficient ?? 1),
                        0
                    ),

                    quantiteTotaleControlee: sessions.reduce(
                        (sum, session) =>
                            sum + Number(session.quantiteControlee ?? 0),
                        0
                    ),
                };
            })
            .sort((a, b) => {
                const dateA = new Date(a.lastDetectedAt).getTime();
                const dateB = new Date(b.lastDetectedAt).getTime();

                if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
                    return 0;
                }

                if (Number.isNaN(dateA)) {
                    return 1;
                }

                if (Number.isNaN(dateB)) {
                    return -1;
                }

                return dateB - dateA;
            });
    }, [defauts, ordreByNumero]);

    const filteredOrders = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return ordresAvecDefauts.filter((ordre) => {
            const matchesOrder =
                !numeroOfFilter ||
                String(ordre.numeroOf) === String(numeroOfFilter);

            const searchableValues = [
                ordre.numeroOf,
                ordre.referenceProduit,
                ordre.quantite,
                ...ordre.ilots,
            ]
                .filter(
                    (value) => value !== null && value !== undefined
                )
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                searchableValues.includes(normalizedSearch);

            return matchesOrder && matchesSearch;
        });
    }, [ordresAvecDefauts, search, numeroOfFilter]);

    const manufacturingOrderNumbers = useMemo(() => {
        return ordresAvecDefauts
            .map((ordre) => ordre.numeroOf)
            .filter(
                (numeroOf) =>
                    numeroOf !== null && numeroOf !== undefined
            )
            .sort((a, b) => {
                const numberA = Number(a);
                const numberB = Number(b);

                if (!Number.isNaN(numberA) && !Number.isNaN(numberB)) {
                    return numberB - numberA;
                }

                return String(b).localeCompare(String(a));
            });
    }, [ordresAvecDefauts]);

    function toggleOrderDetails(orderKey) {
        setExpandedOrder((currentKey) =>
            currentKey === orderKey ? null : orderKey
        );
    }

    function resetFilters() {
        setSearch("");
        setNumeroOfFilter("");
    }

    if (loading) {
        return (
            <main className="defective-products-page">
                <div className="defective-page-state">
                    Chargement des produits défectueux...
                </div>
            </main>
        );
    }

    return (
        <main className="defective-products-page">
            <header className="defective-products-header">
                <div>
                    <button
                        type="button"
                        className="back-button"
                        onClick={() => navigate("/admin")}
                    >
                        ← Retour à l’administration
                    </button>

                    <h1>Produits défectueux</h1>

                    <p>
                        Consultation des ordres de fabrication comportant
                        au moins un défaut détecté.
                    </p>
                </div>

                <button
                    type="button"
                    className="refresh-button"
                    onClick={loadData}
                    disabled={loading}
                >
                    Actualiser
                </button>
            </header>

            {error && (
                <div className="defective-error" role="alert">
                    <span>{error}</span>

                    <button type="button" onClick={loadData}>
                        Réessayer
                    </button>
                </div>
            )}

            {/* The previous summary labels/cards were removed. */}

            <section className="defective-filters">
                <div className="filter-field filter-search">
                    <label htmlFor="defective-search">
                        Rechercher
                    </label>

                    <input
                        id="defective-search"
                        type="search"
                        placeholder="N° OF, référence ou îlot..."
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                    />
                </div>

                <div className="filter-field">
                    <label htmlFor="of-filter">
                        Ordre de fabrication
                    </label>

                    <select
                        id="of-filter"
                        value={numeroOfFilter}
                        onChange={(event) =>
                            setNumeroOfFilter(event.target.value)
                        }
                    >
                        <option value="">Tous les OF</option>

                        {manufacturingOrderNumbers.map((numeroOf) => (
                            <option
                                key={numeroOf}
                                value={numeroOf}
                            >
                                OF {numeroOf}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="button"
                    className="reset-button"
                    onClick={resetFilters}
                >
                    Réinitialiser
                </button>
            </section>

            <section className="defective-table-container">
                <div className="table-result-count">
                    {filteredOrders.length} ordre
                    {filteredOrders.length !== 1 ? "s" : ""} de
                    fabrication trouvé
                    {filteredOrders.length !== 1 ? "s" : ""}
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="defective-empty-state">
                        Aucun ordre de fabrication ne correspond aux
                        critères sélectionnés.
                    </div>
                ) : (
                    <div className="defective-table-scroll">
                        <table className="defective-products-table">
                            <thead>
                                <tr>
                                    <th scope="col">
                                        N° ordre de fabrication
                                    </th>

                                    <th scope="col">
                                        Référence produit
                                    </th>

                                    <th scope="col">Quantité OF</th>
                                    <th scope="col">Total contrôlé</th>
                                    <th scope="col">Sessions</th>
                                    <th scope="col">Somme des défauts</th>


                                    <th scope="col">Îlot</th>

                                    <th scope="col">
                                        Dernière détection
                                    </th>

                                    <th scope="col">Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredOrders.map((ordre) => {
                                    const isExpanded =
                                        expandedOrder === ordre.key;
                                    const detailsId = `order-details-${ordre.key}`;

                                    return (
                                        <Fragment key={ordre.key}>
                                            <tr>
                                                <td>
                                                    <strong>
                                                        OF {ordre.numeroOf}
                                                    </strong>
                                                </td>

                                                <td>
                                                    {ordre.referenceProduit}
                                                </td>

                                                <td>{ordre.quantite}</td>
                                                <td>{ordre.quantiteTotaleControlee}</td>

                                                <td>{ordre.sessions.length}</td>
                                                <td>
                                                    {ordre.nombreDefauts}
                                                </td>

                                                <td>
                                                    {ordre.ilots.length >
                                                        0
                                                        ? ordre.ilots.join(
                                                            ", "
                                                        )
                                                        : "—"}
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        ordre.lastDetectedAt
                                                    )}
                                                </td>

                                                <td>
                                                    <button
                                                        type="button"
                                                        className="details-button"
                                                        aria-expanded={
                                                            isExpanded
                                                        }
                                                        aria-controls={
                                                            detailsId
                                                        }
                                                        onClick={() =>
                                                            toggleOrderDetails(
                                                                ordre.key
                                                            )
                                                        }
                                                    >
                                                        {isExpanded
                                                            ? "Masquer les détails"
                                                            : "Voir les détails"}
                                                    </button>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="details-row">
                                                    <td colSpan={9}>
                                                        <div
                                                            id={detailsId}
                                                            className="product-defects"
                                                        >
                                                            <div className="details-heading">
                                                                <div>
                                                                    <h2>
                                                                        Détails
                                                                        de
                                                                        l’OF{" "}
                                                                        {
                                                                            ordre.numeroOf
                                                                        }
                                                                    </h2>

                                                                    <p>
                                                                        {
                                                                            ordre.referenceProduit
                                                                        }{" "}
                                                                        —{" "}
                                                                        {
                                                                            ordre.nombreDefauts
                                                                        }{" "}
                                                                        défaut
                                                                        {ordre.nombreDefauts !==
                                                                            1
                                                                            ? "s"
                                                                            : ""}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="session-list">
                                                                {ordre.sessions.map((session) => (
                                                                    <section
                                                                        key={session.key}
                                                                        className="session-card"
                                                                    >
                                                                        <header className="session-card-header">
                                                                            <div>
                                                                                <h3>
                                                                                    Session #{session.id ?? "—"}
                                                                                </h3>

                                                                                <p>
                                                                                    Démarrée le {formatDate(session.createdAt)}
                                                                                </p>
                                                                            </div>

                                                                            <div className="session-summary">
                                                                                <span>
                                                                                    <strong>
                                                                                        {session.quantiteControlee ?? "Non renseignée"}
                                                                                    </strong>
                                                                                    {" "}contrôlés
                                                                                </span>

                                                                                <span>
                                                                                    <strong>
                                                                                        {session.nombreProduitsDefectueux}
                                                                                    </strong>
                                                                                    {" "}produits défectueux
                                                                                </span>

                                                                                <span>
                                                                                    <strong>{session.nombreDefauts}</strong>
                                                                                    {" "}défauts
                                                                                </span>
                                                                            </div>
                                                                        </header>

                                                                        <div className="session-meta">
                                                                            <span>
                                                                                Contrôleur :{" "}
                                                                                <strong>{session.controleurLabel}</strong>
                                                                            </span>

                                                                            <span>
                                                                                Opérateur :{" "}
                                                                                <strong>
                                                                                    {session.operateurId
                                                                                        ? `#${session.operateurId}`
                                                                                        : "—"}
                                                                                </strong>
                                                                            </span>
                                                                        </div>

                                                                        <div className="defective-table-scroll">
                                                                            <table className="defect-details-table">
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th scope="col">N° produit</th>
                                                                                        <th scope="col">Code erreur</th>
                                                                                        <th scope="col">Repère TOPO</th>
                                                                                        <th scope="col">Coefficient</th>
                                                                                        <th scope="col">Îlot</th>
                                                                                        <th scope="col">Date</th>
                                                                                        <th scope="col">Observation</th>
                                                                                    </tr>
                                                                                </thead>

                                                                                <tbody>
                                                                                    {groupByNumeroProduit(
                                                                                        session.defauts
                                                                                    ).map(
                                                                                        ([
                                                                                            numeroProduit,
                                                                                            defautsDuProduit,
                                                                                        ]) =>
                                                                                            defautsDuProduit.map(
                                                                                                (defaut, index) => (
                                                                                                    <tr
                                                                                                        key={
                                                                                                            defaut.id ??
                                                                                                            `${session.key}-${numeroProduit}-${index}`
                                                                                                        }
                                                                                                    >
                                                                                                        {index === 0 && (
                                                                                                            <td
                                                                                                                rowSpan={
                                                                                                                    defautsDuProduit.length
                                                                                                                }
                                                                                                                className="defect-produit-cell"
                                                                                                            >
                                                                                                                {numeroProduit}
                                                                                                            </td>
                                                                                                        )}

                                                                                                        <td>
                                                                                                            {getErrorCode(defaut)}
                                                                                                        </td>

                                                                                                        <td>
                                                                                                            {defaut.repere_topo || "—"}
                                                                                                        </td>

                                                                                                        <td>
                                                                                                            {defaut.coefficient ?? 1}
                                                                                                        </td>

                                                                                                        <td>
                                                                                                            {getIlotName(defaut)}
                                                                                                        </td>

                                                                                                        <td>
                                                                                                            {formatDate(
                                                                                                                defaut.created_at
                                                                                                            )}
                                                                                                        </td>

                                                                                                        <td>
                                                                                                            {defaut.observation || "—"}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                )
                                                                                            )
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </section>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}

export default ProduitsDefectueux;