import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import "../styles/admin/GestionTypesDefaut.css";

import {
  getTypesByPoste,
  addTypeToPoste,
  updateTypeDefaut,
  deleteTypeDefaut,
} from "../../services/typesDefautService";


function GestionTypesDefaut() {
  const navigate = useNavigate();
  const location = useLocation();

  const { ilotId, posteId } = useParams();

  const ilot = location.state?.ilot;
  const poste = location.state?.poste;

  const [typesDefaut, setTypesDefaut] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");

  const [typeEnEdition, setTypeEnEdition] = useState(null);
  const [nomModifie, setNomModifie] = useState("");


  const afficherErreur = (err, messageParDefaut) => {
    return (
      err.response?.data?.detail ||
      err.message ||
      messageParDefaut
    );
  };


  const chargerTypesDefaut = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getTypesByPoste(posteId);
      setTypesDefaut(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Impossible de charger les types de défaut."
        )
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (posteId) {
      chargerTypesDefaut();
    }
  }, [posteId]);


  const ajouterTypeDefaut = async (e) => {
    e.preventDefault();

    const nomNettoye = name.trim();

    if (!nomNettoye) {
      setError(
        "Le nom du type de défaut est obligatoire."
      );
      return;
    }

    try {
      await addTypeToPoste(posteId, nomNettoye);

      setName("");
      setError("");

      await chargerTypesDefaut();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de l'ajout du type de défaut."
        )
      );
    }
  };


  const commencerEdition = (typeDefaut) => {
    setTypeEnEdition(typeDefaut.id);
    setNomModifie(typeDefaut.name);
    setError("");
  };


  const annulerEdition = () => {
    setTypeEnEdition(null);
    setNomModifie("");
    setError("");
  };


  const modifierTypeDefaut = async (id) => {
    const nomNettoye = nomModifie.trim();

    if (!nomNettoye) {
      setError(
        "Le nom du type de défaut est obligatoire."
      );
      return;
    }

    try {
      await updateTypeDefaut(id, nomNettoye);

      annulerEdition();
      await chargerTypesDefaut();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la modification du type de défaut."
        )
      );
    }
  };


  const supprimerTypeDefaut = async (typeDefaut) => {
    const confirmation = window.confirm(
      `Supprimer le type de défaut "${typeDefaut.name}" ? Ses codes erreur seront aussi supprimés.`
    );

    if (!confirmation) return;

    try {
      await deleteTypeDefaut(typeDefaut.id);

      if (typeEnEdition === typeDefaut.id) {
        annulerEdition();
      }

      await chargerTypesDefaut();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la suppression du type de défaut."
        )
      );
    }
  };


  const retournerAuxPostes = () => {
    navigate(
      `/admin/gestion-ilots/${ilotId}/postes`,
      {
        state: {
          ilot,
        },
      }
    );
  };


  const ouvrirCodesErreur = (typeDefaut) => {
    navigate(
      `/admin/gestion-ilots/${ilotId}/postes/${posteId}/types-defaut/${typeDefaut.id}/codes-erreur`,
      {
        state: {
          ilot,
          poste,
          typeDefaut,
        },
      }
    );
  };


  return (
    <div className="gtd-container">
      <div className="gtd-header">
        <button
          type="button"
          className="gtd-back"
          onClick={retournerAuxPostes}
        >
          ← Retour
        </button>

        <div>
          <h1 className="gtd-title">
            Gestion des types de défaut
          </h1>

          <p className="gtd-subtitle">
            Îlot : {ilot?.name || `#${ilotId}`}
            {" | "}
            Poste : {poste?.name || `#${posteId}`}
          </p>
        </div>
      </div>


      {error && (
        <div className="gtd-error">
          {error}
        </div>
      )}


      <form
        className="gtd-form"
        onSubmit={ajouterTypeDefaut}
      >
        <input
          className="gtd-input"
          type="text"
          placeholder="Type de défaut, par exemple : Brasage"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="gtd-btn gtd-btn-add"
          type="submit"
        >
          Ajouter
        </button>
      </form>


      {loading ? (
        <p className="gtd-loading">
          Chargement des types de défaut...
        </p>
      ) : typesDefaut.length === 0 ? (
        <p className="gtd-empty">
          Aucun type de défaut enregistré pour ce poste.
        </p>
      ) : (
        <div className="gtd-table-container">
          <table className="gtd-table">
            <thead>
              <tr>
                <th>Type de défaut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {typesDefaut.map((typeDefaut) => (
                <tr key={typeDefaut.id}>
                  <td>
                    {typeEnEdition === typeDefaut.id ? (
                      <input
                        className="gtd-input"
                        type="text"
                        value={nomModifie}
                        maxLength={20}
                        onChange={(e) =>
                          setNomModifie(e.target.value)
                        }
                      />
                    ) : (
                      typeDefaut.name
                    )}
                  </td>

                  <td>
                    {typeEnEdition === typeDefaut.id ? (
                      <>
                        <button
                          type="button"
                          className="gtd-btn gtd-btn-save"
                          onClick={() =>
                            modifierTypeDefaut(typeDefaut.id)
                          }
                        >
                          Enregistrer
                        </button>

                        <button
                          type="button"
                          className="gtd-btn gtd-btn-cancel"
                          onClick={annulerEdition}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gtd-btn gtd-btn-edit"
                          onClick={() =>
                            commencerEdition(typeDefaut)
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="gtd-btn gtd-btn-codes"
                          onClick={() =>
                            ouvrirCodesErreur(typeDefaut)
                          }
                        >
                          Codes erreur
                        </button>

                        <button
                          type="button"
                          className="gtd-btn gtd-btn-delete"
                          onClick={() =>
                            supprimerTypeDefaut(typeDefaut)
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


export default GestionTypesDefaut;