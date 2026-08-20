import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin/GestionMachines.css";

import { getMachines, addMachine, updateMachine, deleteMachine, } from "../../services/machinesService";


function GestionMachines() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nouveauNom, setNouveauNom] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  const [machineEnEdition, setMachineEnEdition] = useState(null);
  const [nomModifie, setNomModifie] = useState("");

  const chargerMachines = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getMachines();
      setMachines(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Impossible de charger les machines. Vérifiez que le serveur est démarré."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerMachines();
  }, []);

  const handleAjouter = async (e) => {
    e.preventDefault();
    if (!nouveauNom.trim()) return;

    setAjoutEnCours(true);
    setError("");
    try {
      await addMachine(nouveauNom.trim());

      setNouveauNom("");
      chargerMachines();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'ajout");
    } finally {
      setAjoutEnCours(false);
    }
  };

  const commencerEdition = (nom) => {
    setMachineEnEdition(nom);
    setNomModifie(nom);
    setError("");
  };

  const annulerEdition = () => {
    setMachineEnEdition(null);
    setNomModifie("");
  };

  const handleModifier = async (nomActuel) => {
    if (!nomModifie.trim() || nomModifie.trim() === nomActuel) {
      annulerEdition();
      return;
    }

    setError("");
    try {
      await updateMachine(nomActuel, nomModifie.trim());

      annulerEdition();
      chargerMachines();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la modification");
    }
  };


  const handleSupprimer = async (nom) => {
    const confirmation = window.confirm(
      `Supprimer la machine ${nom} et toutes ses données liées ?`
    );

    if (!confirmation) return;

    setError("");

    try {
      await deleteMachine(nom);

      chargerMachines();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la suppression");
    }
  };

  return (
    <div className="gm-container">
      <div className="gm-header">
        <button className="gm-back" onClick={() => navigate("/admin")}>
          ← Retour
        </button>
        <h1 className="gm-title">Gestion des machines</h1>
      </div>

      {error && <div className="gm-error">{error}</div>}

      <form className="gm-form" onSubmit={handleAjouter}>
        <input
          type="text"
          placeholder="Nom de la nouvelle machine"
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          className="gm-input"
        />
        <button type="submit" className="gm-btn gm-btn-add" disabled={ajoutEnCours}>
          {ajoutEnCours ? "Ajout..." : "Ajouter"}
        </button>
      </form>

      {loading ? (
        <p className="gm-loading">Chargement des machines...</p>
      ) : machines.length === 0 ? (
        <p className="gm-empty">Aucune machine enregistrée.</p>
      ) : (
        <table className="gm-table">
          <thead>
            <tr>
              <th>Nom de la machine</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.nom}>
                <td>
                  {machineEnEdition === m.nom ? (
                    <input
                      type="text"
                      value={nomModifie}
                      onChange={(e) => setNomModifie(e.target.value)}
                      className="gm-input-edit"
                      autoFocus
                    />
                  ) : (
                    m.nom
                  )}
                </td>
                <td className="gm-actions-cell">
                  {machineEnEdition === m.nom ? (
                    <>
                      <button
                        className="gm-btn gm-btn-save"
                        onClick={() => handleModifier(m.nom)}
                      >
                        Enregistrer
                      </button>
                      <button className="gm-btn gm-btn-cancel" onClick={annulerEdition}>
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="gm-btn gm-btn-edit"
                        onClick={() => commencerEdition(m.nom)}
                      >
                        Modifier
                      </button>

                      <button
                        className="gm-btn gm-btn-delete"
                        onClick={() => handleSupprimer(m.nom)}
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

export default GestionMachines;