import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import HistoriqueTable from "../../components/HistoriqueTable";
import WorkContextBanner from "../../components/WorkContextBanner";


import {
  addHistorique,
  getDernierEnregistrement,
  getHistoriqueContexteAujourdHui,
} from "../../services/historiqueService";


import { getWorkContext } from "../../services/workContextService";

import "../styles/operateur/RaboutageRechargement.css";

import bobineImg1 from "../../assets/bobine1.jpg";
import bobineImg2 from "../../assets/bobine2.jpg";
import bobineImg3 from "../../assets/bobine3.jpg";


export default function RaboutageRechargement() {
  const navigate = useNavigate();

  const oldBobineInputRef = useRef(null);
  const newBobineInputRef = useRef(null);
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

  const [oldBobine, setOldBobine] = useState("");
  const [newBobine, setNewBobine] = useState("");

  const [codeFeeder, setCodeFeeder] = useState("");
  const [slot, setSlot] = useState("");
  const [positionFeeder, setPositionFeeder] = useState("");
  const [face, setFace] = useState(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [historique, setHistorique] = useState([]);
  const [loadingHistorique, setLoadingHistorique] =
    useState(true);

  const [sourceTrouvee, setSourceTrouvee] = useState(false);
  const [nouvelleBobineConforme, setNouvelleBobineConforme] =
    useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normaliserReference = (reference) => {
    return reference.trim().toUpperCase();
  };

  const afficherErreur = (texte) => {
    setMessageType("error");
    setMessage(texte);
  };

  const afficherSucces = (texte) => {
    setMessageType("success");
    setMessage(texte);
  };

  const chargerHistorique = async () => {
    if (!context) {
      return;
    }

    setLoadingHistorique(true);

    try {
      const result =
        await getHistoriqueContexteAujourdHui(
          context,
          "raboutage_rechargement"
        );

      setHistorique(result.lignes);
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
        "Impossible de charger l’historique du contexte."
      );
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    if (!context) {
      navigate("/", {
        replace: true,
      });

      return;
    }

    chargerHistorique();
  }, []);

  const viderInformationsAutomatiques = () => {
    setCodeFeeder("");
    setSlot("");
    setPositionFeeder("");
    setFace(null);
    setSourceTrouvee(false);
    setNouvelleBobineConforme(false);
  };

  const reinitialiserFormulaire = () => {
    setOldBobine("");
    setNewBobine("");
    viderInformationsAutomatiques();

    setTimeout(() => {
      oldBobineInputRef.current?.focus();
    }, 100);
  };

  const handleOldBobineChange = (event) => {
    setOldBobine(event.target.value);
    setNewBobine("");
    setMessage("");
    setMessageType("");
    viderInformationsAutomatiques();
  };

  const chercherAncienneBobine = async () => {
    if (!context) {
      afficherErreur(
        "Aucun contexte de travail n’est sélectionné."
      );

      return;
    }

    if (!oldBobine.trim()) {
      afficherErreur(
        "Veuillez scanner la référence de l’ancienne bobine."
      );

      oldBobineInputRef.current?.focus();
      return;
    }

    setIsSearching(true);
    setMessageType("");
    setMessage("Recherche de l’ancienne bobine...");
    viderInformationsAutomatiques();

    try {
      const result = await getDernierEnregistrement(
        context,
        oldBobine
      );

      setCodeFeeder(result.reference_feeder);
      setSlot(String(result.numero_slot));
      setPositionFeeder(
        String(result.position_feeder)
      );
      setFace(result.face || null);
      setSourceTrouvee(true);

      afficherSucces(
        "Ancienne bobine trouvée. Scannez maintenant la nouvelle bobine."
      );

      setTimeout(() => {
        newBobineInputRef.current?.focus();
      }, 100);
    } catch (error) {
      viderInformationsAutomatiques();

      afficherErreur(
        error.response?.data?.detail ||
        "Aucune position actuelle trouvée pour cette bobine dans le contexte sélectionné."
      );

      setTimeout(() => {
        oldBobineInputRef.current?.select();
      }, 100);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOldBobineKeyDown = async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await chercherAncienneBobine();
  };

  const verifierNouvelleBobine = () => {
    if (!newBobine.trim()) {
      afficherErreur(
        "Veuillez scanner la référence de la nouvelle bobine."
      );

      setNouvelleBobineConforme(false);
      return false;
    }

    const ancienneReference =
      normaliserReference(oldBobine);

    const nouvelleReference =
      normaliserReference(newBobine);

    if (nouvelleReference !== ancienneReference) {
      afficherErreur(
        "Nouvelle bobine non conforme : sa référence doit être identique à celle de l’ancienne bobine."
      );

      setNouvelleBobineConforme(false);

      setTimeout(() => {
        newBobineInputRef.current?.select();
      }, 100);

      return false;
    }

    setNouvelleBobineConforme(true);

    afficherSucces(
      "Nouvelle bobine conforme. Vous pouvez valider l’opération."
    );

    setTimeout(() => {
      validerButtonRef.current?.focus();
    }, 100);

    return true;
  };

  const handleNewBobineChange = (event) => {
    setNewBobine(event.target.value);
    setNouvelleBobineConforme(false);
    setMessage("");
    setMessageType("");
  };

  const handleNewBobineKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    verifierNouvelleBobine();
  };

  const validerLigne = async () => {
    if (!context) {
      afficherErreur(
        "Aucun contexte de travail n’est sélectionné."
      );

      return;
    }

    if (!conducteur) {
      afficherErreur(
        "Impossible d’identifier l’utilisateur connecté."
      );

      return;
    }

    if (!sourceTrouvee) {
      afficherErreur(
        "Veuillez d’abord scanner une ancienne bobine valide."
      );

      oldBobineInputRef.current?.focus();
      return;
    }

    if (!nouvelleBobineConforme) {
      const conforme = verifierNouvelleBobine();

      if (!conforme) {
        return;
      }
    }

    if (!codeFeeder || !slot || !positionFeeder) {
      afficherErreur(
        "Les informations automatiques sont incomplètes."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const savedHistorique = await addHistorique({
        type_operation: "raboutage_rechargement",

        site: context.site,
        client: context.client,
        conducteur,
        machine: context.machine,

        reference_carte: context.referenceCarte,
        reference_bobine: newBobine.trim(),
        reference_feeder: codeFeeder,

        numero_slot: Number(slot),
        position_feeder: Number(positionFeeder),

        face,
        commentaire:
          `Old bobine=${oldBobine.trim()} check ok`,
      });

      afficherSucces(
        `Raboutage/rechargement ajouté avec succès. ID : ${savedHistorique.historique.id}`
      );

      await chargerHistorique();
      reinitialiserFormulaire();
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
        "Erreur lors de l’enregistrement du raboutage/rechargement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!context) {
    return null;
  }

  return (
    <div className="rab-container">
      <div className="rab-page-header">
        <div>
          <h1 className="rab-title">
            Raboutage / Rechargement
          </h1>

          <p className="rab-user">
            Conducteur : <strong>{conducteur}</strong>
          </p>
        </div>

        <button
          className="rab-back-button"
          type="button"
          disabled={isSubmitting}
          onClick={() => navigate("/")}
        >
          Retour à l’accueil
        </button>
      </div>

      <WorkContextBanner context={context} />

      <div className="rab-main-card">
        <div className="rab-form-section">
          <div className="rab-field">
            <label htmlFor="old-bobine">
              Référence OLD bobine
            </label>

            <input
              ref={oldBobineInputRef}
              id="old-bobine"
              type="text"
              value={oldBobine}
              placeholder="Scanner l’ancienne bobine"
              autoFocus
              disabled={isSearching || isSubmitting}
              onChange={handleOldBobineChange}
              onKeyDown={handleOldBobineKeyDown}
            />
          </div>

          <div className="rab-field">
            <label htmlFor="new-bobine">
              Référence NEW bobine
            </label>

            <input
              ref={newBobineInputRef}
              id="new-bobine"
              type="text"
              value={newBobine}
              placeholder="Scanner la nouvelle bobine"
              disabled={
                !sourceTrouvee ||
                isSearching ||
                isSubmitting
              }
              onChange={handleNewBobineChange}
              onKeyDown={handleNewBobineKeyDown}
            />
          </div>

          {message && (
            <div
              className={`rab-message ${messageType}`}
            >
              {message}
            </div>
          )}
        </div>

        <div className="rab-images">
          <img src={bobineImg1} alt="Ancienne bobine" />

          <img src={bobineImg2} alt="Nouvelle bobine" />

          <img src={bobineImg3} alt="Autre image" />
        </div>
      </div>

      <div className="rab-details-card">
        <div className="rab-field">
          <label htmlFor="code-feeder">
            Code feeder
          </label>

          <input
            id="code-feeder"
            type="text"
            value={codeFeeder}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="rab-field">
          <label htmlFor="slot">SLOT N°</label>

          <input
            id="slot"
            type="text"
            value={slot}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="rab-field">
          <label htmlFor="position-feeder">
            Position feeder
          </label>

          <input
            id="position-feeder"
            type="text"
            value={positionFeeder}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="rab-field">
          <label htmlFor="face">Face</label>

          <input
            id="face"
            type="text"
            value={face || ""}
            placeholder="Automatique"
            readOnly
          />
        </div>

        <div className="rab-actions">
          <button
            ref={validerButtonRef}
            className="rab-btn rab-btn-valider"
            type="button"
            disabled={
              isSearching ||
              isSubmitting ||
              !sourceTrouvee ||
              !nouvelleBobineConforme
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
            className="rab-btn rab-btn-exit"
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
        title="Historique du contexte aujourd’hui"
      />
    </div>
  );
}