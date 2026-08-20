import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSites } from "../../services/siteService";
import { getIlots } from "../../services/ilotsService";
import { getPostesByIlot } from "../../services/postesDetectionService";
import { addOrdreFabrication, getOrdreFabrication, } from "../../services/ordresFabricationService";
import { addSessionControle, } from "../../services/sessionsControleService";

import "../styles/controleur/ControleParameters.css";

const initialFormData = {
  ordreFabrication: "",
  referenceCarte: "",
  quantite: "",
  siteId: "",
  ilotId: "",
  posteDetectionId: "",
  matriculeOperateur: "",
};

const ControleParametres = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);

  const [sites, setSites] = useState([]);
  const [ilots, setIlots] = useState([]);
  const [postesDetection, setPostesDetection] = useState([]);

  const [loadingSiteIlot, setLoadingSiteIlot] = useState(true);
  const [loadingPostes, setLoadingPostes] = useState(false);


  const [ofLookupStatus, setOfLookupStatus] = useState("idle");
  const [ofQuantite, setOfQuantite] = useState(null);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
      item?.site_id ??
      item?.ilot_id ??
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

  useEffect(() => {
    const loadSitesEtIlots = async () => {
      setLoadingSiteIlot(true);
      setError("");

      try {
        const [sitesRes, ilotsRes] = await Promise.all([
          getSites(),
          getIlots(),
        ]);

        setSites(extractList(sitesRes));
        setIlots(extractList(ilotsRes));
      } catch (err) {
        console.error("Erreur chargement sites/îlots :", err);
        setError("Impossible de charger les listes (sites, îlots).");
      } finally {
        setLoadingSiteIlot(false);
      }
    };

    loadSitesEtIlots();
  }, []);

  useEffect(() => {
    if (!formData.ilotId) {
      setPostesDetection([]);
      return;
    }

    const loadPostes = async () => {
      setLoadingPostes(true);
      setError("");

      try {
        const postesRes = await getPostesByIlot(formData.ilotId);
        setPostesDetection(extractList(postesRes));
      } catch (err) {
        console.error("Erreur chargement postes :", err);
        setPostesDetection([]);
        setError(
          "Impossible de charger les postes de contrôle de l'îlot sélectionné."
        );
      } finally {
        setLoadingPostes(false);
      }
    };

    loadPostes();
  }, [formData.ilotId]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setError("");

    setFormData((previousData) => {
      if (name === "ilotId") {
        return {
          ...previousData,
          ilotId: value,
          posteDetectionId: "",
        };
      }

      if (name === "ordreFabrication") {
        setOfLookupStatus("idle");
        setOfQuantite(null);

        return {
          ...previousData,
          ordreFabrication: value,
          referenceCarte: "",
          quantite: "",
          siteId: "",
        };
      }

      return {
        ...previousData,
        [name]: value,
      };
    });
  };

  const handleOrdreFabricationBlur = async () => {
    const numeroOf = formData.ordreFabrication.trim();

    if (!numeroOf) {
      setOfLookupStatus("idle");
      return;
    }

    setOfLookupStatus("loading");
    setError("");

    try {
      const ordre = await getOrdreFabrication(numeroOf);

      setFormData((previousData) => ({
        ...previousData,
        referenceCarte: ordre.reference_produit,
        quantite: String(ordre.quantite),
        siteId: String(ordre.site_id),
      }));

      setOfQuantite(ordre.quantite);
      setOfLookupStatus("found");
    } catch (err) {
      setOfQuantite(null);

      if (err?.response?.status === 404) {
        setOfLookupStatus("not_found");
        return;
      }

      console.error("Erreur vérification OF :", err);

      setOfLookupStatus("error");
      setError(
        err?.response?.data?.detail ??
        "Impossible de vérifier l'ordre de fabrication."
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (ofLookupStatus === "loading") {
      setError("Veuillez attendre la fin de la recherche de l'OF.");
      return;
    }

    if (
      ofLookupStatus !== "found" &&
      ofLookupStatus !== "not_found"
    ) {
      setError("Veuillez d'abord vérifier le numéro d'OF.");
      return;
    }

    if (!formData.ordreFabrication.trim()) {
      setError("Veuillez saisir un ordre de fabrication.");
      return;
    }

    if (!formData.referenceCarte.trim()) {
      setError("Veuillez saisir la référence de produit.");
      return;
    }

    if (!formData.siteId) {
      setError("Veuillez sélectionner un site.");
      return;
    }

    if (!formData.ilotId) {
      setError("Veuillez sélectionner un îlot.");
      return;
    }

    if (!formData.posteDetectionId) {
      setError("Veuillez sélectionner un poste de contrôle.");
      return;
    }

    if (!formData.matriculeOperateur.trim()) {
      setError("Veuillez saisir le matricule opérateur.");
      return;
    }

    const isNewOf = ofLookupStatus === "not_found";

    if (isNewOf && !formData.quantite) {
      setError("Veuillez saisir la quantité de l'OF.");
      return;
    }

    const selectedSite = sites.find(
      (site) => getItemId(site) === formData.siteId
    );

    const selectedIlot = ilots.find(
      (ilot) => getItemId(ilot) === formData.ilotId
    );

    const selectedPoste = postesDetection.find(
      (poste) => getItemId(poste) === formData.posteDetectionId
    );

    setSubmitting(true);

    try {
      const numeroOf = Number(formData.ordreFabrication);

      if (isNewOf) {
        await addOrdreFabrication(
          numeroOf,
          formData.referenceCarte.trim(),
          Number(formData.quantite),
          Number(formData.siteId)
        );
      }

      const sessionResult = await addSessionControle({
        numeroOf,
        operateurId: Number(formData.matriculeOperateur),
        ilotId: Number(formData.ilotId),
        posteDetectionId: Number(formData.posteDetectionId),
      });

      const sessionId = sessionResult?.session?.id;

      if (!sessionId) {
        throw new Error("Identifiant de session manquant");
      }

      navigate(
        "/controle-qualite/ControleParametres/SaisieDefauts",
        {
          state: {
            sessionId,
            controle: {
              ...formData,
              ordreFabrication: numeroOf,
              quantite: isNewOf
                ? Number(formData.quantite)
                : Number(ofQuantite),
            },
            site: selectedSite,
            ilot: selectedIlot,
            posteDetection: selectedPoste,
          },
        }
      );
    } catch (err) {
      console.error("Erreur démarrage du contrôle :", err);

      setError(
        err?.response?.data?.detail ??
        "Impossible de démarrer la session de contrôle."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="controle-page">
      <div className="controle-container">
        <header className="controle-header">
          <div className="controle-header-icon" aria-hidden="true">
            ▣
          </div>

          <div>
            <p className="controle-header-category">
              Production électronique
            </p>

            <h1 className="controle-title">Contrôle</h1>

            <p className="controle-subtitle">
              Saisissez les informations du contrôle avant de déclarer un
              problème de production.
            </p>
          </div>
        </header>

        <form className="controle-form" onSubmit={handleSubmit}>
          <div className="controle-form-header">
            <h2>Informations de contrôle</h2>
            <p>Tous les champs sont obligatoires.</p>
          </div>

          {error && (
            <div className="controle-error-message" role="alert">
              <span className="controle-error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <div className="controle-form-grid">
            <div className="controle-form-group">
              <label htmlFor="ordreFabrication">
                Ordre de fabrication
              </label>

              <input
                id="ordreFabrication"
                name="ordreFabrication"
                type="number"
                value={formData.ordreFabrication}
                onChange={handleChange}
                onBlur={handleOrdreFabricationBlur}
                placeholder="Exemple : 804731"
                required
              />

              {ofLookupStatus === "loading" && (
                <p className="controle-field-hint">Recherche...</p>
              )}
              {ofLookupStatus === "error" && (
                <p className="controle-field-hint controle-field-hint--error">
                  Vérification impossible. Réessayez.
                </p>
              )}




              {ofLookupStatus === "not_found" && (
                <p className="controle-field-hint">
                  Nouvel OF — saisissez la référence, la quantité et le site.
                </p>
              )}
            </div>

            <div className="controle-form-group">
              <label htmlFor="referenceCarte">
                Référence de produit
              </label>

              <input
                id="referenceCarte"
                name="referenceCarte"
                type="text"
                value={formData.referenceCarte}
                onChange={handleChange}
                readOnly={ofLookupStatus === "found"}
                placeholder="Exemple : EVOCP010053/F0"
                required
              />
            </div>

            <div className="controle-form-group">
              <label htmlFor="quantite">
                Quantité totale de l'OF
              </label>

              <input
                id="quantite"
                name="quantite"
                type="number"
                min="1"
                step="1"
                value={formData.quantite}
                onChange={handleChange}
                readOnly={ofLookupStatus === "found"}
                placeholder={
                  ofLookupStatus === "idle"
                    ? "Saisissez d'abord le numéro d'OF"
                    : "Exemple : 2567"
                }
                required
              />

              {ofLookupStatus === "found" && (
                <p className="controle-field-hint">
                  Quantité planifiée enregistrée pour cet OF.
                </p>
              )}

              {ofLookupStatus === "not_found" && (
                <p className="controle-field-hint">
                  Indiquez la quantité totale planifiée du nouvel OF.
                </p>
              )}
            </div>
            <div className="controle-form-group">
              <label htmlFor="siteId">Site</label>

              <select
                id="siteId"
                name="siteId"
                value={formData.siteId}
                onChange={handleChange}
                disabled={loadingSiteIlot || ofLookupStatus === "found"}
                required
              >
                <option value="">
                  {loadingSiteIlot
                    ? "Chargement des sites..."
                    : "Sélectionner un site"}
                </option>

                {sites.map((site) => (
                  <option key={getItemId(site)} value={getItemId(site)}>
                    {getItemLabel(site)}
                  </option>
                ))}
              </select>
            </div>

            <div className="controle-form-group">
              <label htmlFor="ilotId">Îlot</label>

              <select
                id="ilotId"
                name="ilotId"
                value={formData.ilotId}
                onChange={handleChange}
                disabled={loadingSiteIlot}
                required
              >
                <option value="">
                  {loadingSiteIlot
                    ? "Chargement des îlots..."
                    : "Sélectionner un îlot"}
                </option>

                {ilots.map((ilot) => (
                  <option key={getItemId(ilot)} value={getItemId(ilot)}>
                    {getItemLabel(ilot)}
                  </option>
                ))}
              </select>
            </div>

            <div className="controle-form-group">
              <label htmlFor="posteDetectionId">
                Poste de contrôle
              </label>

              <select
                id="posteDetectionId"
                name="posteDetectionId"
                value={formData.posteDetectionId}
                onChange={handleChange}
                disabled={!formData.ilotId || loadingPostes}
                required
              >
                <option value="">
                  {!formData.ilotId
                    ? "Sélectionnez d'abord un îlot"
                    : loadingPostes
                      ? "Chargement des postes..."
                      : "Sélectionner un poste"}
                </option>

                {postesDetection.map((poste) => (
                  <option key={getItemId(poste)} value={getItemId(poste)}>
                    {getItemLabel(poste)}
                  </option>
                ))}
              </select>
            </div>

            <div className="controle-form-group">
              <label htmlFor="matriculeOperateur">
                Matricule opérateur
              </label>

              <input
                id="matriculeOperateur"
                name="matriculeOperateur"
                type="number"
                value={formData.matriculeOperateur}
                onChange={handleChange}
                placeholder="Exemple : 1024"
                required
              />
            </div>
          </div>

          <div className="controle-button-container">
            <button
              className="controle-submit-button"
              type="submit"
              disabled={submitting || ofLookupStatus === "loading"}
            >
              {submitting
                ? "Démarrage du contrôle..."
                : "Valider le contrôle"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default ControleParametres;