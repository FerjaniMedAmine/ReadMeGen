import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin/GestionClients.css";
import { getClients, addClient, updateClient, deleteClient } from "../../services/clientsService";



function GestionClients() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nom, setNom] = useState("");

  const [clientEnEdition, setClientEnEdition] = useState(null);
  const [nomModifie, setNomModifie] = useState("");

  const chargerClients = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerClients();
  }, []);

  const ajouterClient = async (e) => {
    e.preventDefault();

    if (!nom.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    try {
      await addClient(nom.trim());
      setNom("");
      chargerClients();
    } catch (err) {
      setError(err.message);
    }
  };

  const commencerEdition = (client) => {
    setClientEnEdition(client.id);
    setNomModifie(client.nom);
    setError("");
  };

  const annulerEdition = () => {
    setClientEnEdition(null);
    setNomModifie("");
  };

  const modifierClient = async (id) => {
    if (!nomModifie.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    try {
      await updateClient(id, nomModifie.trim());

      annulerEdition();
      chargerClients();
    } catch (err) {
      setError(err.message);
    }
  };

  const supprimerClient = async (id) => {
    const confirmation = window.confirm(
      "Supprimer ce client ? Ses cartes et guides liés seront aussi supprimés."
    );

    if (!confirmation) return;

    try {
      await deleteClient(id);

      chargerClients();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="gc-container">
      <div className="gc-header">
        <button className="gc-back" onClick={() => navigate("/admin")}>
          ← Retour
        </button>

        <h1 className="gc-title">Gestion des clients</h1>
      </div>

      {error && <div className="gc-error">{error}</div>}

      <form className="gc-form" onSubmit={ajouterClient}>
        <input
          className="gc-input"
          type="text"
          placeholder="Nom du client"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />

        <button className="gc-btn gc-btn-add" type="submit">
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="gc-loading">Chargement des clients...</p>
      ) : clients.length === 0 ? (
        <p className="gc-empty">Aucun client enregistré.</p>
      ) : (
        <table className="gc-table">
          <thead>
            <tr>

              <th>Nom du client</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>


                <td>
                  {clientEnEdition === client.id ? (
                    <input
                      className="gc-input"
                      value={nomModifie}
                      onChange={(e) => setNomModifie(e.target.value)}
                    />
                  ) : (
                    client.nom
                  )}
                </td>

                <td>
                  {clientEnEdition === client.id ? (
                    <>
                      <button
                        type="button"
                        className="gc-btn gc-btn-save"
                        onClick={() => modifierClient(client.id)}
                      >
                        Enregistrer
                      </button>

                      <button
                        type="button"
                        className="gc-btn gc-btn-cancel"
                        onClick={annulerEdition}
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="gc-btn gc-btn-edit"
                        onClick={() => commencerEdition(client)}
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        className="gc-btn gc-btn-cards"
                        onClick={() =>
                          navigate(`/admin/gestion-clients/${client.id}/cartes`, {
                            state: { client },
                          })
                        }
                      >
                        Cartes
                      </button>

                      <button
                        type="button"
                        className="gc-btn gc-btn-delete"
                        onClick={() => supprimerClient(client.id)}
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
      )}
    </div>
  );
}

export default GestionClients;
