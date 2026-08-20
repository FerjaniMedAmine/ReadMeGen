import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getTypesByPoste } from "../../services/typesDefautService";
import { getCodesByType } from "../../services/codesErreurService";
import { addDefautDetecte, getDefautsDetectes } from "../../services/defautsDetectesService";

import "../styles/controleur/SaisieDefauts.css";


const CABLE_ILOT_ID = 4;

const initialDefautForm = {
  typeDefautId: "",
  codeDefautId: "",
  repereTopo: "",
  nombreDefaut: "1",
  observation: "",
};

const extractList = (response) => {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
};

const getItemId = (item) => {
  return String(
    item?.id ??
    item?.type_defaut_id ??
    item?.code_erreur_id ??
    item?.poste_detection_id ??
    item?.code ??
    ""
  );
};

const getItemLabel = (item) => {
  return (
    item?.nom ??
    item?.name ??
    item?.libelle ??
    item?.designation ??
    item?.code ??
    "Sans nom"
  );
};

const SaisieDefauts = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    sessionId,
    controle,
    site,
    ilot,
    posteDetection,
  } = location.state ?? {};

  const posteId = posteDetection ? getItemId(posteDetection) : "";
  const isCable = ilot && String(getItemId(ilot)) === String(CABLE_ILOT_ID);
  const produitLabel = isCable ? "câble" : "flan";

  const [numeroProduit, setNumeroProduit] = useState(1);
  const [defautForm, setDefautForm] = useState(initialDefautForm);
  const [historique, setHistorique] = useState([]);

  const [typesDefaut, setTypesDefaut] = useState([]);
  const [codesDefaut, setCodesDefaut] = useState([]);

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!sessionId || !controle?.referenceCarte) {
      navigate("/controle-qualite/ControleParametres", {
        replace: true,
      });
    }
  }, [sessionId, controle, navigate]);

  useEffect(() => {
    if (!posteId) {
      setTypesDefaut([]);
      setLoadingTypes(false);
      return;
    }

    const loadTypes = async () => {
      setLoadingTypes(true);
      setError("");

      try {
        const typesRes = await getTypesByPoste(posteId);
        setTypesDefaut(extractList(typesRes));
      } catch (err) {
        console.error("Erreur chargement types de défaut :", err);
        setTypesDefaut([]);
        setError("Impossible de charger les types de défaut pour ce poste.");
      } finally {
        setLoadingTypes(false);
      }
    };

    loadTypes();
  }, [posteId]);

  // codes de défaut depend on the selected type de défaut.
  useEffect(() => {
    if (!defautForm.typeDefautId) {
      setCodesDefaut([]);
      return;
    }

    const loadCodes = async () => {
      setLoadingCodes(true);
      setError("");

      try {
        const codesRes = await getCodesByType(defautForm.typeDefautId);
        setCodesDefaut(extractList(codesRes));
      } catch (err) {
        console.error("Erreur chargement codes de défaut :", err);
        setCodesDefaut([]);
        setError("Impossible de charger les codes de défaut pour ce type.");
      } finally {
        setLoadingCodes(false);
      }
    };

    loadCodes();
  }, [defautForm.typeDefautId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    const loadHistorique = async () => {
      try {
        const rows = extractList(
          await getDefautsDetectes({
            sessionId: Number(sessionId),
          })
        );

        if (cancelled) {
          return;
        }

        setHistorique(
          rows.map((row) => ({
            id: row.id,
            numeroProduit: row.numero_produit,
            typeDefautLabel: row.type_defaut_label ?? "—",
            codeDefautLabel: row.code_defaut_label ?? "—",
            repereTopo: row.repere_topo ?? "—",
            coefficient: row.coefficient,
            observation: row.observation ?? "",
          }))
        );
      } catch (err) {
        console.error("Erreur chargement historique :", err);

        if (!cancelled) {
          setError(
            "Impossible de charger l'historique des défauts."
          );
        }
      }
    };

    loadHistorique();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  const handleChange = (event) => {
    const { name, value } = event.target;
    setError("");

    setDefautForm((previous) => {
      if (name === "typeDefautId") {
        return {
          ...previous,
          typeDefautId: value,
          codeDefautId: "",
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const handleNumeroProduitChange = (event) => {
    const value = event.target.value;
    setNumeroProduit(value === "" ? "" : Number(value));
  };

  const handleProduitSuivant = () => {
    setNumeroProduit((previous) => (previous === "" ? 1 : previous + 1));
    setDefautForm(initialDefautForm);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setAlerts([]);
    if (!sessionId) {
      setError("Session de contrôle invalide.");
      return;
    }

    if (!numeroProduit) {
      setError(`Veuillez indiquer le numéro de ${produitLabel}.`);
      return;
    }

    if (
      !defautForm.typeDefautId ||
      !defautForm.codeDefautId ||
      !defautForm.repereTopo.trim() ||
      (!isCable && !defautForm.nombreDefaut)
    ) {
      setError("Veuillez remplir tous les champs obligatoires du défaut.");
      return;
    }



    const selectedType = typesDefaut.find(
      (type) => getItemId(type) === defautForm.typeDefautId
    );

    const selectedCode = codesDefaut.find(
      (code) => getItemId(code) === defautForm.codeDefautId
    );

    const coefficient = isCable ? 1 : Number(defautForm.nombreDefaut);

    setSaving(true);

    try {
      const result = await addDefautDetecte({
        sessionId: Number(sessionId),
        codeErreurId: Number(defautForm.codeDefautId),
        repereTopo: defautForm.repereTopo.trim(),
        coefficient,
        observation: defautForm.observation.trim(),
        numeroProduit: Number(numeroProduit),
      });
      const detectedAlerts = Array.isArray(result?.alerts)
        ? result.alerts
        : [];

      setAlerts(detectedAlerts);
      const nouvelleLigne = {
        id: result?.defaut?.id ?? `${Date.now()}`,
        numeroProduit,
        typeDefautLabel: getItemLabel(selectedType),
        codeDefautLabel: getItemLabel(selectedCode),
        repereTopo: defautForm.repereTopo.trim(),
        coefficient,
        observation: defautForm.observation.trim(),
      };

      setHistorique((previous) => [nouvelleLigne, ...previous]);

      setDefautForm((previous) => ({
        ...previous,
        repereTopo: "",
        nombreDefaut: "1",
        observation: "",
      }));
    } catch (err) {
      console.error("Erreur enregistrement défaut :", err);
      setError(
        err?.response?.data?.detail ?? "Impossible d'enregistrer le défaut."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="cq-page">
      <div className="cq-container">
        <header className="cq-topbar">
          <div className="cq-label-pair">
            <span className="cq-label-key">Référence Carte</span>
            <span className="cq-label-value">
              {controle?.referenceCarte ?? "—"}
            </span>
          </div>

          <div className="cq-label-pair">
            <span className="cq-label-key">OF</span>
            <span className="cq-label-value">
              {controle?.ordreFabrication ?? "—"}
            </span>
          </div>
        </header>

        {(site || ilot || posteDetection) && (
          <div className="cq-context">
            {site && <span>Site : {site.nom ?? site.name}</span>}
            {ilot && <span>Îlot : {ilot.nom ?? ilot.name}</span>}
            {posteDetection && (
              <span>Poste : {posteDetection.nom ?? posteDetection.name}</span>
            )}
          </div>
        )}



        <div className="cq-produit-bar">
          <div className="cq-field">
            <label htmlFor="numeroProduit">
              Numéro de {produitLabel}
            </label>
            <input
              id="numeroProduit"
              type="number"
              min="1"
              step="1"
              value={numeroProduit}
              onChange={handleNumeroProduitChange}
            />
          </div>

          <button
            type="button"
            className="cq-btn cq-btn-secondary"
            onClick={handleProduitSuivant}
          >
            {produitLabel === "câble" ? "Câble suivant" : "Flan suivant"}
          </button>
        </div>

        <form className="cq-form" onSubmit={handleSave}>
          {error && (
            <div className="cq-error-message" role="alert">
              <span className="cq-error-icon">!</span>
              <span>{error}</span>
            </div>
          )}
          {alerts.length > 0 && (
            <div
              className="cq-production-alert"
              role="alert"
              aria-live="assertive"
            >
              <div className="cq-production-alert__header">
                <span
                  className="cq-production-alert__icon"
                  aria-hidden="true"
                >
                  !
                </span>

                <div>
                  <strong>Arrêt de production requis</strong>
                  <p>
                    Un ou plusieurs seuils qualité ont été atteints.
                  </p>
                </div>
              </div>

              <ul className="cq-production-alert__list">
                {alerts.map((alert, index) => (
                  <li key={`${alert.type}-${index}`}>
                    <strong>{alert.message}</strong>

                    <div className="cq-production-alert__details">
                      {alert.code_defaut && (
                        <span>
                          Code défaut : {alert.code_defaut}
                        </span>
                      )}

                      {alert.repere_topo && (
                        <span>
                          Repère TOPO : {alert.repere_topo}
                        </span>
                      )}

                      {alert.occurrences != null && (
                        <span>
                          Occurrences : {alert.occurrences}
                        </span>
                      )}

                      {alert.coefficient_total != null && (
                        <span>
                          Coefficient total :{" "}
                          {alert.coefficient_total}/{alert.seuil ?? 6}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset
            disabled={!sessionId || saving}
            className="cq-form-grid"
          >
            <div className="cq-field">
              <label htmlFor="typeDefautId">Type de Défaut</label>
              <select
                id="typeDefautId"
                name="typeDefautId"
                value={defautForm.typeDefautId}
                onChange={handleChange}
                disabled={loadingTypes}
              >
                <option value="">
                  {loadingTypes ? "Chargement..." : "Sélectionner"}
                </option>
                {typesDefaut.map((type) => (
                  <option key={getItemId(type)} value={getItemId(type)}>
                    {getItemLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="cq-field">
              <label htmlFor="codeDefautId">Code de défaut</label>
              <select
                id="codeDefautId"
                name="codeDefautId"
                value={defautForm.codeDefautId}
                onChange={handleChange}
                disabled={!defautForm.typeDefautId || loadingCodes}
              >
                <option value="">
                  {!defautForm.typeDefautId
                    ? "Sélectionnez d'abord un type"
                    : loadingCodes
                      ? "Chargement..."
                      : "Sélectionner"}
                </option>
                {codesDefaut.map((code) => (
                  <option key={getItemId(code)} value={getItemId(code)}>
                    {getItemLabel(code)}
                  </option>
                ))}
              </select>
            </div>

            <div className="cq-field">
              <label htmlFor="repereTopo">Repère TOPO :</label>
              <input
                id="repereTopo"
                name="repereTopo"
                type="text"
                value={defautForm.repereTopo}
                onChange={handleChange}
              />
            </div>

            {!isCable && (
              <div className="cq-field">
                <label htmlFor="nombreDefaut">
                  Nombre de cartes affectées
                </label>
                <input
                  id="nombreDefaut"
                  name="nombreDefaut"
                  type="number"
                  min="1"
                  step="1"
                  value={defautForm.nombreDefaut}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="cq-field cq-field-full">
              <label htmlFor="observation">Observation :</label>
              <textarea
                id="observation"
                name="observation"
                rows={2}
                value={defautForm.observation}
                onChange={handleChange}
              />
            </div>
          </fieldset>

          <div className="cq-actions">
            <button
              type="submit"
              className="cq-btn cq-btn-save"
              disabled={saving || !sessionId}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              className="cq-btn cq-btn-secondary"
              disabled={saving || !sessionId}
              onClick={() =>
                navigate("/controle-qualite/quantite-controlee", {
                  state: {
                    sessionId,
                    controle,
                    site,
                    ilot,
                    posteDetection,
                  },
                })
              }
            >
              Terminer le contrôle
            </button>
          </div>
        </form>

        <section className="cq-history">
          <h2>Historique des défauts saisis</h2>

          {historique.length === 0 ? (
            <p className="cq-history-empty">Aucun défaut saisi pour l'instant.</p>
          ) : (
            <div className="cq-history-table-wrap">
              <table className="cq-history-table">
                <thead>
                  <tr>
                    <th>N° {produitLabel}</th>
                    <th>Type Défaut</th>
                    <th>Code Défaut</th>
                    <th>TOPO</th>
                    {!isCable && <th>Nb Cartes</th>}
                    <th>Observation</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map((ligne) => (
                    <tr key={ligne.id}>
                      <td>{ligne.numeroProduit}</td>
                      <td>{ligne.typeDefautLabel}</td>
                      <td>{ligne.codeDefautLabel}</td>
                      <td>{ligne.repereTopo}</td>
                      {!isCable && <td>{ligne.coefficient}</td>}
                      <td>{ligne.observation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default SaisieDefauts;