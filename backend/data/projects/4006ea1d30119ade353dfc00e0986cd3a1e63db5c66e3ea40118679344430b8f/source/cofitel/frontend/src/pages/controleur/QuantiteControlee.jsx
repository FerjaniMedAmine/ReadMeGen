import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  cloturerSessionControle,
} from "../../services/sessionsControleService";

import "../styles/controleur/QuantiteControlee.css";


const QuantiteControlee = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    sessionId,
    controle,
    site,
    ilot,
    posteDetection,
  } = location.state ?? {};

  const [quantiteControlee, setQuantiteControlee] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const produitLabel =
    String(ilot?.id ?? ilot?.ilot_id) === "4"
      ? "câbles"
      : "cartes";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!sessionId) {
      setError("Session de contrôle introuvable.");
      return;
    }

    const quantite = Number(quantiteControlee);

    if (
      quantiteControlee === "" ||
      !Number.isInteger(quantite) ||
      quantite < 0
    ) {
      setError(
        "Veuillez saisir une quantité contrôlée valide."
      );
      return;
    }

    if (quantite === 0) {
      const continuer = window.confirm(
        "La quantité contrôlée est égale à 0. Voulez-vous continuer ?"
      );

      if (!continuer) {
        return;
      }
    }

    setSaving(true);

    try {
      await cloturerSessionControle({
        sessionId: Number(sessionId),
        quantiteControlee: quantite,
      });

      setSuccess(true);
    } catch (err) {
      console.error("Erreur clôture session :", err);

      setError(
        err?.response?.data?.detail ??
          "Impossible d'enregistrer la quantité contrôlée."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!sessionId) {
    return (
      <main className="quantite-page">
        <div className="quantite-container">
          <div className="quantite-message quantite-message--error">
            Session de contrôle introuvable.
          </div>

          <button
            type="button"
            className="quantite-btn quantite-btn--secondary"
            onClick={() =>
              navigate("/controle-qualite/ControleParametres")
            }
          >
            Retour
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="quantite-page">
      <div className="quantite-container">
        <header className="quantite-header">
          <p className="quantite-category">
            Finalisation du contrôle
          </p>

          <h1>Quantité contrôlée</h1>

          <p>
            Indiquez le nombre total de {produitLabel} contrôlés
            pendant cette session.
          </p>
        </header>

        <section className="quantite-context">
          <div>
            <span>OF</span>
            <strong>
              {controle?.ordreFabrication ?? "—"}
            </strong>
          </div>

          <div>
            <span>Référence</span>
            <strong>
              {controle?.referenceCarte ?? "—"}
            </strong>
          </div>

          {site && (
            <div>
              <span>Site</span>
              <strong>{site.nom ?? site.name ?? "—"}</strong>
            </div>
          )}

          {ilot && (
            <div>
              <span>Îlot</span>
              <strong>{ilot.nom ?? ilot.name ?? "—"}</strong>
            </div>
          )}

          {posteDetection && (
            <div>
              <span>Poste</span>
              <strong>
                {posteDetection.nom ??
                  posteDetection.name ??
                  "—"}
              </strong>
            </div>
          )}
        </section>

        {success ? (
          <section className="quantite-success">
            <h2>Contrôle enregistré</h2>

            <p>
              La session a été clôturée avec une quantité de{" "}
              <strong>{quantiteControlee}</strong> {produitLabel}.
            </p>

            <button
              type="button"
              className="quantite-btn quantite-btn--primary"
              onClick={() => navigate("/controle-qualite")}
            >
              Retour à l'accueil
            </button>
          </section>
        ) : (
          <form
            className="quantite-form"
            onSubmit={handleSubmit}
          >
            <div className="quantite-field">
              <label htmlFor="quantiteControlee">
                Nombre de {produitLabel} contrôlés
              </label>

              <input
                id="quantiteControlee"
                type="number"
                min="0"
                step="1"
                value={quantiteControlee}
                onChange={(event) => {
                  setQuantiteControlee(event.target.value);
                  setError("");
                }}
                placeholder="Exemple : 250"
                autoFocus
                required
              />
            </div>

            {error && (
              <div
                className="quantite-message quantite-message--error"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="quantite-actions">
              <button
                type="button"
                className="quantite-btn quantite-btn--secondary"
                disabled={saving}
                onClick={() => navigate(-1)}
              >
                Retour aux défauts
              </button>

              <button
                type="submit"
                className="quantite-btn quantite-btn--primary"
                disabled={saving}
              >
                {saving
                  ? "Enregistrement..."
                  : "Terminer le contrôle"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

export default QuantiteControlee;