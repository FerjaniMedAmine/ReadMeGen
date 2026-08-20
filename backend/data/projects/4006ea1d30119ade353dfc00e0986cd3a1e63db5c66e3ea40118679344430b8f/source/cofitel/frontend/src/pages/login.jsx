import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../services/authService";

import "./styles/Login.css";


function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setErreur("");
    setChargement(true);

    try {
      const data = await login(username, password);

      sessionStorage.setItem(
        "access_token",
        data.access_token
      );

      sessionStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      const role = data.user?.role?.toLowerCase();

      switch (role) {
        case "admin":
          navigate("/admin", {
            replace: true,
          });
          break;

        case "controleur":
          navigate("/controle-qualite", {
            replace: true,
          });
          break;

        case "operateur":
          navigate("/", {
            replace: true,
          });
          break;

        default:
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("user");

          setErreur(
            "Votre compte ne possède aucun rôle valide."
          );
      }
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        "Impossible de se connecter au serveur.";

      setErreur(message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <div className="login-company">
            Cofitel
          </div>

          <h1 className="login-title">
            Connexion
          </h1>

          <p className="login-description">
            Connectez-vous pour accéder à l'application.
          </p>
        </header>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <div className="login-field">
            <label htmlFor="username">
              Nom d'utilisateur
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={username}
              placeholder="Saisir votre nom d'utilisateur"
              autoComplete="username"
              autoFocus
              disabled={chargement}
              required
              onChange={(event) =>
                setUsername(event.target.value)
              }
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">
              Mot de passe
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              placeholder="Saisir votre mot de passe"
              autoComplete="current-password"
              disabled={chargement}
              required
              onChange={(event) =>
                setPassword(event.target.value)
              }
            />
          </div>

          {erreur && (
            <div
              className="login-error"
              role="alert"
            >
              {erreur}
            </div>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={
              chargement ||
              !username.trim() ||
              !password
            }
          >
            {chargement
              ? "Connexion en cours..."
              : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}


export default Login;