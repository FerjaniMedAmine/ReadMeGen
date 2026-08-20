import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import "../styles/admin/GestionCodesErreur.css";

import {
  getCodesByType,
  addCodeToType,
  updateCodeErreur,
  deleteCodeErreur,
} from "../../services/codesErreurService";


function GestionCodesErreur() {
  const navigate = useNavigate();
  const location = useLocation();

  const { ilotId, posteId, typeId } = useParams();

  const ilot = location.state?.ilot;
  const poste = location.state?.poste;
  const typeDefaut = location.state?.typeDefaut;

  const [codesErreur, setCodesErreur] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");

  const [codeEnEdition, setCodeEnEdition] = useState(null);
  const [codeModifie, setCodeModifie] = useState("");


  const afficherErreur = (err, messageParDefaut) => {
    return (
      err.response?.data?.detail ||
      err.message ||
      messageParDefaut
    );
  };


  const chargerCodesErreur = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getCodesByType(typeId);
      setCodesErreur(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Impossible de charger les codes erreur."
        )
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (typeId) {
      chargerCodesErreur();
    }
  }, [typeId]);


  const ajouterCodeErreur = async (e) => {
    e.preventDefault();

    const codeNettoye = code.trim();

    if (!codeNettoye) {
      setError("Le code erreur est obligatoire.");
      return;
    }

    try {
      await addCodeToType(typeId, codeNettoye);

      setCode("");
      setError("");

      await chargerCodesErreur();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de l'ajout du code erreur."
        )
      );
    }
  };


  const commencerEdition = (codeErreur) => {
    setCodeEnEdition(codeErreur.id);
    setCodeModifie(codeErreur.code);
    setError("");
  };


  const annulerEdition = () => {
    setCodeEnEdition(null);
    setCodeModifie("");
    setError("");
  };


  const modifierCodeErreur = async (id) => {
    const codeNettoye = codeModifie.trim();

    if (!codeNettoye) {
      setError("Le code erreur est obligatoire.");
      return;
    }

    try {
      await updateCodeErreur(id, codeNettoye);

      annulerEdition();
      await chargerCodesErreur();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la modification du code erreur."
        )
      );
    }
  };


  const supprimerCodeErreur = async (codeErreur) => {
    const confirmation = window.confirm(
      `Supprimer le code erreur "${codeErreur.code}" ?`
    );

    if (!confirmation) return;

    try {
      await deleteCodeErreur(codeErreur.id);

      if (codeEnEdition === codeErreur.id) {
        annulerEdition();
      }

      await chargerCodesErreur();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la suppression du code erreur."
        )
      );
    }
  };


  const retournerAuxTypes = () => {
    navigate(
      `/admin/gestion-ilots/${ilotId}/postes/${posteId}/types-defaut`,
      {
        state: {
          ilot,
          poste,
        },
      }
    );
  };


  return (
    <div className="gce-container">
      <div className="gce-header">
        <button
          type="button"
          className="gce-back"
          onClick={retournerAuxTypes}
        >
          ← Retour
        </button>

        <div>
          <h1 className="gce-title">
            Gestion des codes erreur
          </h1>

          <p className="gce-subtitle">
            Îlot : {ilot?.name || `#${ilotId}`}
            {" | "}
            Poste : {poste?.name || `#${posteId}`}
            {" | "}
            Type : {typeDefaut?.name || `#${typeId}`}
          </p>
        </div>
      </div>


      {error && (
        <div className="gce-error">
          {error}
        </div>
      )}


      <form
        className="gce-form"
        onSubmit={ajouterCodeErreur}
      >
        <input
          className="gce-input"
          type="text"
          placeholder="Exemple : 11- Brasage - Court circuit"
          value={code}
          maxLength={100}
          onChange={(e) => setCode(e.target.value)}
        />

        <button
          className="gce-btn gce-btn-add"
          type="submit"
        >
          Ajouter
        </button>
      </form>


      {loading ? (
        <p className="gce-loading">
          Chargement des codes erreur...
        </p>
      ) : codesErreur.length === 0 ? (
        <p className="gce-empty">
          Aucun code erreur enregistré pour ce type de défaut.
        </p>
      ) : (
        <div className="gce-table-container">
          <table className="gce-table">
            <thead>
              <tr>
                <th>Code erreur</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {codesErreur.map((codeErreur) => (
                <tr key={codeErreur.id}>
                  <td>
                    {codeEnEdition === codeErreur.id ? (
                      <input
                        className="gce-input"
                        type="text"
                        value={codeModifie}
                        maxLength={100}
                        onChange={(e) =>
                          setCodeModifie(e.target.value)
                        }
                      />
                    ) : (
                      codeErreur.code
                    )}
                  </td>

                  <td>
                    {codeEnEdition === codeErreur.id ? (
                      <>
                        <button
                          type="button"
                          className="gce-btn gce-btn-save"
                          onClick={() =>
                            modifierCodeErreur(codeErreur.id)
                          }
                        >
                          Enregistrer
                        </button>

                        <button
                          type="button"
                          className="gce-btn gce-btn-cancel"
                          onClick={annulerEdition}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gce-btn gce-btn-edit"
                          onClick={() =>
                            commencerEdition(codeErreur)
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="gce-btn gce-btn-delete"
                          onClick={() =>
                            supprimerCodeErreur(codeErreur)
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


export default GestionCodesErreur;