import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "../styles/admin/GestionCartesClient.css";
import {
  getCartesByClient,
  addCarteToClient,
  deleteCarte,
} from "../../services/cartesService";

function GestionCartesClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const client = location.state?.client;

  const [cartes, setCartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const chargerCartes = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getCartesByClient(id);
      setCartes(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Impossible de charger les cartes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCartes();
  }, [id]);

  const ajouterCarte = async (e) => {
    e.preventDefault();

    if (!reference.trim()) {
      setError("La référence carte est obligatoire.");
      return;
    }

    try {
      await addCarteToClient(id, reference.trim());

      setReference("");
      setError("");
      await chargerCartes();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur réseau lors de l'ajout."
      );
    }
  };

  const supprimerCarte = async (referenceCarte) => {
    const confirmation = window.confirm(
      `Supprimer la carte ${referenceCarte} et son guide lié ?`
    );

    if (!confirmation) return;

    try {
      await deleteCarte(referenceCarte);
      await chargerCartes();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur réseau lors de la suppression."
      );
    }
  };

  return (
    <div className="gcc-container">
      <div className="gcc-header">
        <button
          className="gcc-back"
          onClick={() => navigate("/admin/gestion-clients")}
        >
          ← Retour
        </button>

        <h1 className="gcc-title">
          Cartes Client {client ? `- ${client.nom}` : ""}
        </h1>
      </div>

      {error && <div className="gcc-error">{error}</div>}

      <form className="gcc-form" onSubmit={ajouterCarte}>
        <input
          className="gcc-input"
          type="text"
          placeholder="Référence carte"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />

        <button className="gcc-btn gcc-btn-add" type="submit">
          Ajouter carte
        </button>
      </form>

      {loading ? (
        <p className="gcc-loading">Chargement des cartes...</p>
      ) : cartes.length === 0 ? (
        <p className="gcc-empty">
          Aucune carte enregistrée pour ce client.
        </p>
      ) : (
        <table className="gcc-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {cartes.map((carte) => (
              <tr key={carte.reference}>
                <td>{carte.reference}</td>

                <td>
                  <button
                    type="button"
                    className="gcc-btn gcc-btn-guide"
                    onClick={() =>
                      navigate("/admin/guide-carte", {
                        state: {
                          carte,
                          client,
                        },
                      })
                    }
                  >
                    Guide
                  </button>

                  <button
                    type="button"
                    className="gcc-btn gcc-btn-delete"
                    onClick={() => supprimerCarte(carte.reference)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionCartesClient;