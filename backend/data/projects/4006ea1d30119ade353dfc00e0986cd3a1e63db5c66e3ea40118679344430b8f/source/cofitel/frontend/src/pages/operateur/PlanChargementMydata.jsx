import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import WorkContextBanner from "../../components/WorkContextBanner";
import HistoriqueTable from "../../components/HistoriqueTable";

import { lookupGuideLine } from "../../services/guideService";
import {
  addHistorique,
  getHistoriqueContexteAujourdHui,
} from "../../services/historiqueService";
import { getWorkContext } from "../../services/workContextService";

import "../styles/operateur/PlanChargementMydata.css";


export default function PlanChargementMydata() {
  const navigate = useNavigate();

  const bobineInputRef = useRef(null);
  const feederInputRef = useRef(null);
  const validerButtonRef = useRef(null);

  const context = getWorkContext();

  const storedUser = sessionStorage.getItem("user");

  let currentUser = null;

  try {
    currentUser = storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    currentUser = null;
  }

  const conducteur = currentUser?.username || "";

  const [slot, setSlot] = useState("");
  const [positionFeeder, setPositionFeeder] = useState("");
  const [codeFeeder, setCodeFeeder] = useState("");
  const [bobine, setBobine] = useState("");
  const [face, setFace] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [historique, setHistorique] = useState([]);
  const [loadingHistorique, setLoadingHistorique] =
    useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chargerHistorique = async () => {
    if (!context) {
      return;
    }

    setLoadingHistorique(true);

    try {
      const result = await getHistoriqueContexteAujourdHui(
        context,
        "suivi_plan_chargement"
      );

      setHistorique(result.lignes);
    } catch (error) {
      setMessageType("error");

      setMessage(
        error.response?.data?.detail ||
        "Impossible de charger l’historique du contexte."
      );
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    if (!context) {
      navigate("/", { replace: true });
      return;
    }

    chargerHistorique();
  }, []);

  const afficherErreur = (texte) => {
    setMessageType("error");
    setMessage(texte);
  };

  const afficherSucces = (texte) => {
    setMessageType("success");
    setMessage(texte);
  };

  const chercherGuideBobine = async () => {
    if (!context) {
      afficherErreur("Aucun contexte de travail n’est sélectionné.");
      return;
    }

    if (!bobine.trim()) {
      afficherErreur("Veuillez scanner une bobine.");
      bobineInputRef.current?.focus();
      return;
    }

    setIsSearching(true);
    setMessageType("");
    setMessage("Recherche du slot et de la position...");

    try {
      const result = await lookupGuideLine(
        context.referenceCarte,
        context.machine,
        bobine.trim()
      );

      if (!result.found) {
        setSlot("");
        setPositionFeeder("");
        setFace("");

        afficherErreur(
          result.message ||
          "Composant non trouvé dans le guide."
        );

        bobineInputRef.current?.select();
        return;
      }

      setSlot(String(result.slot_numero));
      setPositionFeeder(String(result.position ?? ""));
      setFace(result.face || "");

      afficherSucces(
        "Slot, position et face trouvés automatiquement."
      );

      setTimeout(() => {
        feederInputRef.current?.focus();
      }, 100);
    } catch (error) {
      setSlot("");
      setPositionFeeder("");
      setFace("");

      afficherErreur(
        error.response?.data?.detail ||
        "Erreur lors de la recherche dans le guide."
      );

      setTimeout(() => {
        bobineInputRef.current?.select();
      }, 100);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBobineChange = (event) => {
    setBobine(event.target.value);
    setSlot("");
    setPositionFeeder("");
    setFace("");
    setMessage("");
    setMessageType("");
  };

  const handleBobineKeyDown = async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await chercherGuideBobine();
  };

  const handleFeederKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!codeFeeder.trim()) {
      afficherErreur("Veuillez scanner le code feeder.");
      return;
    }

    validerLigne();
  };

  const reinitialiserLigne = () => {
    setCodeFeeder("");
    setBobine("");
    setSlot("");
    setPositionFeeder("");
    setFace("");

    setTimeout(() => {
      bobineInputRef.current?.focus();
    }, 100);
  };

  const validerLigne = async () => {
    if (!context) {
      afficherErreur("Aucun contexte de travail n’est sélectionné.");
      return;
    }

    if (!conducteur) {
      afficherErreur("Impossible d’identifier l’utilisateur connecté.");
      return;
    }

    if (!bobine.trim()) {
      afficherErreur("Veuillez scanner une bobine.");
      bobineInputRef.current?.focus();
      return;
    }

    if (!slot || !positionFeeder) {
      afficherErreur("Veuillez scanner une bobine valide.");
      bobineInputRef.current?.select();
      return;
    }

    if (!codeFeeder.trim()) {
      afficherErreur("Veuillez scanner le code feeder.");
      feederInputRef.current?.focus();
      return;
    }

    if (!face) {
      afficherErreur("Face introuvable, veuillez rescanner la bobine.");
      return;
    }

    setIsSubmitting(true);

    try {
      const savedHistorique = await addHistorique({
        type_operation: "suivi_plan_chargement",

        site: context.site,
        client: context.client,
        conducteur,
        machine: context.machine,

        reference_carte: context.referenceCarte,
        reference_bobine: bobine.trim(),
        reference_feeder: codeFeeder.trim(),

        numero_slot: Number(slot),
        position_feeder: Number(positionFeeder),

        face,
        commentaire: null,
      });

      afficherSucces(
        `Ligne ajoutée avec succès. ID : ${savedHistorique.historique.id}`
      );

      await chargerHistorique();
      reinitialiserLigne();
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
        "Erreur lors de l’enregistrement dans l’historique."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!context) {
    return null;
  }

  return (
    <div className="plan-container">
      <div className="plan-page-header">
        <div>
          <h1 className="plan-title">
            Suivi du plan de chargement
          </h1>

          <p className="plan-user">
            Conducteur : <strong>{conducteur}</strong>
          </p>
        </div>

        <button
          className="plan-back-button"
          type="button"
          disabled={isSubmitting}
          onClick={() => navigate("/")}
        >
          Retour à l’accueil
        </button>
      </div>

      <WorkContextBanner context={context} />

      <div className="plan-card">
        <div className="plan-form-group">
          <label htmlFor="bobine">
            Référence de la bobine utilisée
          </label>

          <input
            ref={bobineInputRef}
            id="bobine"
            type="text"
            placeholder="Scanner la bobine"
            value={bobine}
            autoFocus
            disabled={isSearching || isSubmitting}
            onChange={handleBobineChange}
            onKeyDown={handleBobineKeyDown}
          />
        </div>

        <div className="plan-form-group">
          <label htmlFor="feeder">
            Code-barres du feeder utilisé
          </label>

          <input
            ref={feederInputRef}
            id="feeder"
            type="text"
            placeholder="Scanner le code feeder"
            value={codeFeeder}
            disabled={
              !slot ||
              !positionFeeder ||
              isSearching ||
              isSubmitting
            }
            onChange={(event) => setCodeFeeder(event.target.value)}
            onKeyDown={handleFeederKeyDown}
          />
        </div>

        <div className="plan-form-group">
          <label htmlFor="slot">SLOT N°</label>

          <input
            id="slot"
            type="text"
            value={slot}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="plan-form-group">
          <label htmlFor="position">Position feeder</label>

          <input
            id="position"
            type="text"
            value={positionFeeder}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="plan-form-group">
          <label htmlFor="face">Face</label>

          <input
            id="face"
            type="text"
            value={face}
            placeholder="Automatique"
            readOnly
          />
        </div>

        {message && (
          <div className={`plan-message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="button-group">
          <button
            ref={validerButtonRef}
            className="plan-button validate"
            type="button"
            disabled={
              isSearching ||
              isSubmitting ||
              !bobine.trim() ||
              !codeFeeder.trim() ||
              !slot ||
              !positionFeeder ||
              !face
            }
            onClick={validerLigne}
          >
            {isSubmitting
              ? "Enregistrement..."
              : isSearching
                ? "Recherche..."
                : "Valider"}
          </button>

          <button
            className="plan-button exit"
            type="button"
            disabled={isSubmitting}
            onClick={() => navigate("/")}
          >
            EXIT
          </button>
        </div>
      </div>

      <HistoriqueTable
        lignes={historique}
        loading={loadingHistorique}
        title="Historique"
      />
    </div>
  );
}