import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../../services/usersService";

import "../styles/admin/GestionOperateurs.css";

const ROLES_AUTORISES = ["operateur", "controleur"];

function afficherRole(role) {
  switch (role) {
    case "operateur":
      return "Opérateur";

    case "controleur":
      return "Contrôleur";

    default:
      return role || "Non renseigné";
  }
}

function GestionOperateurs() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulaire d'ajout
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operateur");

  // Formulaire de modification
  const [userEnEdition, setUserEnEdition] = useState(null);
  const [usernameModifie, setUsernameModifie] = useState("");
  const [passwordModifie, setPasswordModifie] = useState("");

  const chargerUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur lors du chargement des utilisateurs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerUsers();
  }, []);

  const ajouterUtilisateur = async (event) => {
    event.preventDefault();
    setError("");

    const usernameNettoye = username.trim();

    if (!usernameNettoye) {
      setError("Le nom d'utilisateur est obligatoire.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (!ROLES_AUTORISES.includes(role)) {
      setError("Veuillez sélectionner un rôle valide.");
      return;
    }

    try {
      await addUser(usernameNettoye, password, role);

      setUsername("");
      setPassword("");
      setRole("operateur");

      await chargerUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur lors de l'ajout de l'utilisateur."
      );
    }
  };

  const supprimerUtilisateur = async (id) => {
    const confirmation = window.confirm(
      "Voulez-vous supprimer cet utilisateur ?"
    );

    if (!confirmation) {
      return;
    }

    setError("");

    try {
      await deleteUser(id);

      if (userEnEdition === id) {
        annulerEdition();
      }

      await chargerUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur lors de la suppression de l'utilisateur."
      );
    }
  };

  const commencerEdition = (user) => {
    setUserEnEdition(user.id);
    setUsernameModifie(user.username);
    setPasswordModifie("");
    setError("");
  };

  const annulerEdition = () => {
    setUserEnEdition(null);
    setUsernameModifie("");
    setPasswordModifie("");
  };

  const modifierUtilisateur = async (id) => {
    setError("");

    const usernameNettoye = usernameModifie.trim();

    if (!usernameNettoye) {
      setError("Le nom d'utilisateur est obligatoire.");
      return;
    }

    if (passwordModifie && passwordModifie.length < 8) {
      setError(
        "Le nouveau mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    try {
      await updateUser(
        id,
        usernameNettoye,
        passwordModifie || null
      );

      annulerEdition();
      await chargerUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Erreur lors de la modification de l'utilisateur."
      );
    }
  };

  return (
    <div className="go-container">
      <div className="go-header">
        <button
          className="go-back"
          type="button"
          onClick={() => navigate("/admin")}
        >
          ← Retour
        </button>

        <h1 className="go-title">Gestion des utilisateurs</h1>
      </div>

      {error && (
        <div className="go-error" role="alert">
          {error}
        </div>
      )}

      <form className="go-form" onSubmit={ajouterUtilisateur}>
        <input
          className="go-input"
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          autoComplete="off"
          onChange={(event) => setUsername(event.target.value)}
        />

        <input
          className="go-input"
          type="password"
          placeholder="Mot de passe"
          value={password}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
        />

        <select
          className="go-input go-select"
          value={role}
          aria-label="Rôle de l'utilisateur"
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="operateur">Opérateur</option>
          <option value="controleur">Contrôleur</option>
        </select>

        <button className="go-btn go-btn-add" type="submit">
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="go-loading">Chargement des utilisateurs...</p>
      ) : users.length === 0 ? (
        <p className="go-empty">Aucun utilisateur enregistré.</p>
      ) : (
        <div className="go-table-wrapper">
          <table className="go-table">
            <thead>
              <tr>
                <th>Nom d'utilisateur</th>
                <th>Rôle</th>
                <th>Nouveau mot de passe</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {userEnEdition === user.id ? (
                      <input
                        className="go-input"
                        type="text"
                        value={usernameModifie}
                        onChange={(event) =>
                          setUsernameModifie(event.target.value)
                        }
                      />
                    ) : (
                      user.username
                    )}
                  </td>

                  <td>
                    <span
                      className={`go-role go-role-${
                        user.role || "inconnu"
                      }`}
                    >
                      {afficherRole(user.role)}
                    </span>
                  </td>

                  <td>
                    {userEnEdition === user.id ? (
                      <input
                        className="go-input"
                        type="password"
                        placeholder="Laisser vide pour conserver"
                        value={passwordModifie}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setPasswordModifie(event.target.value)
                        }
                      />
                    ) : (
                      "••••••••"
                    )}
                  </td>

                  <td>
                    <div className="go-actions">
                      {userEnEdition === user.id ? (
                        <>
                          <button
                            className="go-btn go-btn-add"
                            type="button"
                            onClick={() =>
                              modifierUtilisateur(user.id)
                            }
                          >
                            Enregistrer
                          </button>

                          <button
                            className="go-btn go-btn-cancel"
                            type="button"
                            onClick={annulerEdition}
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="go-btn go-btn-edit"
                            type="button"
                            onClick={() => commencerEdition(user)}
                          >
                            Modifier
                          </button>

                          <button
                            className="go-btn go-btn-delete"
                            type="button"
                            onClick={() =>
                              supprimerUtilisateur(user.id)
                            }
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
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

export default GestionOperateurs;