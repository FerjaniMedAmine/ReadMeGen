import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import "../styles/admin/GestionPostesDetection.css";

import {
  getPostesByIlot,
  addPosteToIlot,
  updatePosteDetection,
  deletePosteDetection,
} from "../../services/postesDetectionService";


function GestionPostesDetection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ilotId } = useParams();

  const ilot = location.state?.ilot;

  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");

  const [posteEnEdition, setPosteEnEdition] = useState(null);
  const [nomModifie, setNomModifie] = useState("");


  const afficherErreur = (err, messageParDefaut) => {
    return (
      err.response?.data?.detail ||
      err.message ||
      messageParDefaut
    );
  };


  const chargerPostes = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPostesByIlot(ilotId);
      setPostes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Impossible de charger les postes de détection."
        )
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (ilotId) {
      chargerPostes();
    }
  }, [ilotId]);


  const ajouterPoste = async (e) => {
    e.preventDefault();

    const nomNettoye = name.trim();

    if (!nomNettoye) {
      setError(
        "Le nom du poste de détection est obligatoire."
      );
      return;
    }

    try {
      await addPosteToIlot(ilotId, nomNettoye);

      setName("");
      setError("");

      await chargerPostes();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de l'ajout du poste de détection."
        )
      );
    }
  };


  const commencerEdition = (poste) => {
    setPosteEnEdition(poste.id);
    setNomModifie(poste.name);
    setError("");
  };


  const annulerEdition = () => {
    setPosteEnEdition(null);
    setNomModifie("");
    setError("");
  };


  const modifierPoste = async (id) => {
    const nomNettoye = nomModifie.trim();

    if (!nomNettoye) {
      setError(
        "Le nom du poste de détection est obligatoire."
      );
      return;
    }

    try {
      await updatePosteDetection(id, nomNettoye);

      annulerEdition();
      await chargerPostes();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la modification du poste de détection."
        )
      );
    }
  };


  const supprimerPoste = async (poste) => {
    const confirmation = window.confirm(
      `Supprimer le poste "${poste.name}" ? Ses types de défaut et codes erreur seront aussi supprimés.`
    );

    if (!confirmation) return;

    try {
      await deletePosteDetection(poste.id);

      if (posteEnEdition === poste.id) {
        annulerEdition();
      }

      await chargerPostes();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la suppression du poste de détection."
        )
      );
    }
  };


  return (
    <div className="gpd-container">
      <div className="gpd-header">
        <button
          type="button"
          className="gpd-back"
          onClick={() =>
            navigate("/admin/gestion-ilots")
          }
        >
          ← Retour
        </button>

        <div>
          <h1 className="gpd-title">
            Gestion des postes de détection
          </h1>

          <p className="gpd-subtitle">
            Îlot : {ilot?.name || `#${ilotId}`}
          </p>
        </div>
      </div>


      {error && (
        <div className="gpd-error">
          {error}
        </div>
      )}


      <form
        className="gpd-form"
        onSubmit={ajouterPoste}
      >
        <input
          className="gpd-input"
          type="text"
          placeholder="Nom du poste de détection"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="gpd-btn gpd-btn-add"
          type="submit"
        >
          Ajouter
        </button>
      </form>


      {loading ? (
        <p className="gpd-loading">
          Chargement des postes de détection...
        </p>
      ) : postes.length === 0 ? (
        <p className="gpd-empty">
          Aucun poste de détection enregistré pour cet îlot.
        </p>
      ) : (
        <div className="gpd-table-container">
          <table className="gpd-table">
            <thead>
              <tr>
                <th>Nom du poste</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {postes.map((poste) => (
                <tr key={poste.id}>
                  <td>
                    {posteEnEdition === poste.id ? (
                      <input
                        className="gpd-input"
                        type="text"
                        value={nomModifie}
                        maxLength={50}
                        onChange={(e) =>
                          setNomModifie(e.target.value)
                        }
                      />
                    ) : (
                      poste.name
                    )}
                  </td>

                  <td>
                    {posteEnEdition === poste.id ? (
                      <>
                        <button
                          type="button"
                          className="gpd-btn gpd-btn-save"
                          onClick={() =>
                            modifierPoste(poste.id)
                          }
                        >
                          Enregistrer
                        </button>

                        <button
                          type="button"
                          className="gpd-btn gpd-btn-cancel"
                          onClick={annulerEdition}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gpd-btn gpd-btn-edit"
                          onClick={() =>
                            commencerEdition(poste)
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="gpd-btn gpd-btn-types"
                          onClick={() =>
                            navigate(
                              `/admin/gestion-ilots/${ilotId}/postes/${poste.id}/types-defaut`,
                              {
                                state: {
                                  ilot,
                                  poste,
                                },
                              }
                            )
                          }
                        >
                          Types de défaut
                        </button>

                        <button
                          type="button"
                          className="gpd-btn gpd-btn-delete"
                          onClick={() =>
                            supprimerPoste(poste)
                          }
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export default GestionPostesDetection;