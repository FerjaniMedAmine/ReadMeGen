import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin/GestionIlots.css";

import {
  getIlots,
  addIlot,
  updateIlot,
  deleteIlot,
} from "../../services/ilotsService";


function GestionIlots() {
  const navigate = useNavigate();

  const [ilots, setIlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");

  const [ilotEnEdition, setIlotEnEdition] = useState(null);
  const [nomModifie, setNomModifie] = useState("");


  const afficherErreur = (err, messageParDefaut) => {
    return (
      err.response?.data?.detail ||
      err.message ||
      messageParDefaut
    );
  };


  const chargerIlots = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getIlots();
      setIlots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Impossible de charger les îlots."
        )
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    chargerIlots();
  }, []);


  const ajouterIlot = async (e) => {
    e.preventDefault();

    const nomNettoye = name.trim();

    if (!nomNettoye) {
      setError("Le nom de l'îlot est obligatoire.");
      return;
    }

    try {
      await addIlot(nomNettoye);

      setName("");
      setError("");

      await chargerIlots();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de l'ajout de l'îlot."
        )
      );
    }
  };


  const commencerEdition = (ilot) => {
    setIlotEnEdition(ilot.id);
    setNomModifie(ilot.name);
    setError("");
  };


  const annulerEdition = () => {
    setIlotEnEdition(null);
    setNomModifie("");
    setError("");
  };


  const modifierIlot = async (id) => {
    const nomNettoye = nomModifie.trim();

    if (!nomNettoye) {
      setError("Le nom de l'îlot est obligatoire.");
      return;
    }

    try {
      await updateIlot(id, nomNettoye);

      annulerEdition();
      await chargerIlots();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la modification de l'îlot."
        )
      );
    }
  };


  const supprimerIlot = async (ilot) => {
    const confirmation = window.confirm(
      `Supprimer l'îlot "${ilot.name}" ? Ses postes de détection, types de défaut et codes erreur seront aussi supprimés.`
    );

    if (!confirmation) return;

    try {
      await deleteIlot(ilot.id);

      if (ilotEnEdition === ilot.id) {
        annulerEdition();
      }

      await chargerIlots();
    } catch (err) {
      setError(
        afficherErreur(
          err,
          "Erreur lors de la suppression de l'îlot."
        )
      );
    }
  };


  return (
    <div className="gi-container">
      <div className="gi-header">
        <button
          type="button"
          className="gi-back"
          onClick={() => navigate("/admin")}
        >
          ← Retour
        </button>

        <h1 className="gi-title">
          Gestion des îlots
        </h1>
      </div>


      {error && (
        <div className="gi-error">
          {error}
        </div>
      )}


      <form
        className="gi-form"
        onSubmit={ajouterIlot}
      >
        <input
          className="gi-input"
          type="text"
          placeholder="Nom de l'îlot"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="gi-btn gi-btn-add"
          type="submit"
        >
          Ajouter
        </button>
      </form>


      {loading ? (
        <p className="gi-loading">
          Chargement des îlots...
        </p>
      ) : ilots.length === 0 ? (
        <p className="gi-empty">
          Aucun îlot enregistré.
        </p>
      ) : (
        <div className="gi-table-container">
          <table className="gi-table">
            <thead>
              <tr>
                <th>Nom de l'îlot</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {ilots.map((ilot) => (
                <tr key={ilot.id}>
                  <td>
                    {ilotEnEdition === ilot.id ? (
                      <input
                        className="gi-input"
                        type="text"
                        value={nomModifie}
                        maxLength={100}
                        onChange={(e) =>
                          setNomModifie(e.target.value)
                        }
                      />
                    ) : (
                      ilot.name
                    )}
                  </td>

                  <td>
                    {ilotEnEdition === ilot.id ? (
                      <>
                        <button
                          type="button"
                          className="gi-btn gi-btn-save"
                          onClick={() =>
                            modifierIlot(ilot.id)
                          }
                        >
                          Enregistrer
                        </button>

                        <button
                          type="button"
                          className="gi-btn gi-btn-cancel"
                          onClick={annulerEdition}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gi-btn gi-btn-edit"
                          onClick={() =>
                            commencerEdition(ilot)
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="gi-btn gi-btn-postes"
                          onClick={() =>
                            navigate(
                              `/admin/gestion-ilots/${ilot.id}/postes`,
                              {
                                state: {
                                  ilot,
                                },
                              }
                            )
                          }
                        >
                          Postes de détection
                        </button>

                        <button
                          type="button"
                          className="gi-btn gi-btn-delete"
                          onClick={() =>
                            supprimerIlot(ilot)
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


export default GestionIlots;