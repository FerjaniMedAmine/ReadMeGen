import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import WorkContextBanner from "../../components/WorkContextBanner";
import HistoriqueTable from "../../components/HistoriqueTable";

import {
  getHistoriqueContexteAujourdHui,
  addHistorique,
} from "../../services/historiqueService";

import { getWorkContext } from "../../services/workContextService";

import "../styles/operateur/Reordonnancement.css";

export default function Reordonnancement() {
  const navigate = useNavigate();

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

  const [operationType, setOperationType] =
    useState("slot");

  const [oldSlot, setOldSlot] = useState("");
  const [newSlot, setNewSlot] = useState("");

  const [oldPosition, setOldPosition] =
    useState("");

  const [newPosition, setNewPosition] =
    useState("");

  const [historiqueSuivi, setHistoriqueSuivi] =
    useState([]);

  const [
    historiqueReordonnancement,
    setHistoriqueReordonnancement,
  ] = useState([]);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [loadingHistorique, setLoadingHistorique] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

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
      const [suivi, reord] = await Promise.all([
        getHistoriqueContexteAujourdHui(
          context,
          "suivi_plan_chargement"
        ),
        getHistoriqueContexteAujourdHui(
          context,
          "reordonnancement"
        ),
      ]);

      setHistoriqueSuivi(suivi.lignes || []);

      setHistoriqueReordonnancement(
        reord.lignes || []
      );
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
          "Impossible de charger l'historique."
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

  const reinitialiser = () => {
    setOldSlot("");
    setNewSlot("");
    setOldPosition("");
    setNewPosition("");
  };

  const reordonnancerSlot = async () => {
    setMessage("");

    if (!oldSlot || !newSlot) {
      afficherErreur(
        "Veuillez saisir l'ancien et le nouveau slot."
      );
      return;
    }

    const lignesOldSlot =
      historiqueSuivi.filter(
        (row) =>
          Number(row.numero_slot) ===
          Number(oldSlot)
      );

    if (lignesOldSlot.length === 0) {
      afficherErreur(
        "Ancien slot introuvable dans l'historique du jour."
      );
      return;
    }

    const nouveauSlotUtilise =
      historiqueSuivi.some(
        (row) =>
          Number(row.numero_slot) ===
          Number(newSlot)
      );

    if (nouveauSlotUtilise) {
      afficherErreur(
        "Le nouveau slot est déjà utilisé."
      );
      return;
    }

    const lignesAInserer =
      lignesOldSlot.map((row) => ({
        ...row,
        numero_slot: Number(newSlot),
        type_operation: "reordonnancement",
        commentaire:
          `Réordonnancement SLOT | Ancien SLOT=${oldSlot} | Nouveau SLOT=${newSlot}`,
      }));

    setIsSubmitting(true);

    try {
      await Promise.all(
        lignesAInserer.map((ligne) =>
          addHistorique(ligne)
        )
      );

      afficherSucces(
        `${lignesAInserer.length} ligne(s) enregistrée(s) dans l'historique.`
      );

      reinitialiser();
      await chargerHistorique();
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
          "Impossible d'enregistrer le réordonnancement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const reordonnancerFeeder = async () => {
    setMessage("");

    if (
      !oldSlot ||
      !oldPosition ||
      !newSlot ||
      !newPosition
    ) {
      afficherErreur(
        "Veuillez renseigner tous les champs."
      );
      return;
    }

    const source =
      historiqueSuivi.find(
        (row) =>
          Number(row.numero_slot) ===
            Number(oldSlot) &&
          Number(row.position_feeder) ===
            Number(oldPosition)
      );

    if (!source) {
      afficherErreur(
        "Aucun feeder trouvé pour le slot et la position indiqués."
      );
      return;
    }

    const destinationOccupee =
      historiqueSuivi.some(
        (row) =>
          Number(row.numero_slot) ===
            Number(newSlot) &&
          Number(row.position_feeder) ===
            Number(newPosition)
      );

    if (destinationOccupee) {
      afficherErreur(
        "La destination est déjà utilisée."
      );
      return;
    }

    const ligneAInserer = {
      ...source,
      numero_slot: Number(newSlot),
      position_feeder: Number(newPosition),
      type_operation: "reordonnancement",
      commentaire:
        `Réordonnancement FEEDER | Ancien SLOT=${oldSlot} Position=${oldPosition} | Nouveau SLOT=${newSlot} Position=${newPosition}`,
    };

    setIsSubmitting(true);

    try {
      await addHistorique(ligneAInserer);

      afficherSucces(
        "Le réordonnancement du feeder a été enregistré."
      );

      reinitialiser();
      await chargerHistorique();
    } catch (error) {
      afficherErreur(
        error.response?.data?.detail ||
          "Impossible d'enregistrer le réordonnancement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!context) {
    return null;
  }

  return (
    <div className="reord-container">
      <div className="reord-page-header">
        <div>
          <h1 className="reord-title">
            Réordonnancement
          </h1>

          <p className="reord-user">
            Conducteur :{" "}
            <strong>{conducteur}</strong>
          </p>
        </div>

        <button
          className="reord-back-button"
          type="button"
          onClick={() => navigate("/")}
        >
          Retour à l'accueil
        </button>
      </div>

      <WorkContextBanner context={context} />

      <div className="reord-card">
        <h2>Type d'opération</h2>

        <div className="reord-mode">
          <label>
            <input
              type="radio"
              checked={
                operationType === "slot"
              }
              onChange={() => {
                setOperationType("slot");
                reinitialiser();
              }}
            />
            Modification position SLOT
          </label>

          <label>
            <input
              type="radio"
              checked={
                operationType === "feeder"
              }
              onChange={() => {
                setOperationType("feeder");
                reinitialiser();
              }}
            />
            Modification position FEEDER
          </label>
        </div>

        {operationType === "slot" && (
          <>
            <div className="reord-form">
              <div className="reord-field">
                <label>
                  Ancien SLOT
                </label>

                <input
                  type="number"
                  value={oldSlot}
                  onChange={(e) =>
                    setOldSlot(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="reord-field">
                <label>
                  Nouveau SLOT
                </label>

                <input
                  type="number"
                  value={newSlot}
                  onChange={(e) =>
                    setNewSlot(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="reord-actions">
              <button
                className="reord-btn reord-btn-primary"
                onClick={reordonnancerSlot}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Enregistrement..."
                  : "Valider le réordonnancement"}
              </button>
            </div>
          </>
        )}

        {operationType === "feeder" && (
          <>
            <div className="reord-form">
              <div className="reord-field">
                <label>
                  Ancien SLOT
                </label>

                <input
                  type="number"
                  value={oldSlot}
                  onChange={(e) =>
                    setOldSlot(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="reord-field">
                <label>
                  Ancienne Position
                </label>

                <input
                  type="number"
                  value={oldPosition}
                  onChange={(e) =>
                    setOldPosition(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="reord-field">
                <label>
                  Nouveau SLOT
                </label>

                <input
                  type="number"
                  value={newSlot}
                  onChange={(e) =>
                    setNewSlot(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="reord-field">
                <label>
                  Nouvelle Position
                </label>

                <input
                  type="number"
                  value={newPosition}
                  onChange={(e) =>
                    setNewPosition(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="reord-actions">
              <button
                className="reord-btn reord-btn-primary"
                onClick={reordonnancerFeeder}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Enregistrement..."
                  : "Valider le réordonnancement"}
              </button>
            </div>
          </>
        )}

        {message && (
          <div
            className={`reord-message ${messageType}`}
          >
            {message}
          </div>
        )}
      </div>

      <HistoriqueTable
        lignes={historiqueReordonnancement}
        loading={loadingHistorique}
        title="Historique réordonnancement"
      />
    </div>
  );
}