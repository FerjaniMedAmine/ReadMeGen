import { useNavigate } from "react-router-dom";
import "../styles/controleur/ControleQualite.css";

function ControleQualite() {
  const navigate = useNavigate();

  return (
    <main className="quality-home">
  
      <section
        className="quality-home__actions"
        aria-label="Actions du module qualité"
      >
        <button
          type="button"
          className="quality-action-card quality-action-card--control"
          onClick={() => navigate("/controle-qualite/ControleParametres")}
        >
          <span className="quality-action-card__icon" aria-hidden="true">
            ✓
          </span>

          <span className="quality-action-card__content">
            <span className="quality-action-card__title">
              Contrôle qualité
            </span>

            <span className="quality-action-card__description">
              Démarrer un contrôle et enregistrer les défauts détectés.
            </span>
          </span>

          <span className="quality-action-card__arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button
          type="button"
          className="quality-action-card quality-action-card--analysis"
          onClick={() => navigate("/controle-qualite/analyse")}
        >
          <span className="quality-action-card__icon" aria-hidden="true">
            ▥
          </span>

          <span className="quality-action-card__content">
            <span className="quality-action-card__title">
              Analyse des données
            </span>

            <span className="quality-action-card__description">
              Consulter les indicateurs, l’historique et l’analyse Pareto.
            </span>
          </span>

          <span className="quality-action-card__arrow" aria-hidden="true">
            →
          </span>
        </button>

        
      </section>
    </main>
  );
}

export default ControleQualite;