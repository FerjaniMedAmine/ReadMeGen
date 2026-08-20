import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { getClients } from "../../services/clientsService";
import { getMachines } from "../../services/machinesService";
import { getSites } from "../../services/siteService";
import { checkCarteReference } from "../../services/referenceService";
import { getHistoriqueContexteAujourdHui } from "../../services/historiqueService";
import { getWorkContext, saveWorkContext } from "../../services/workContextService";

import "../styles/operateur/home.css";

export default function Home() {
  const navigate = useNavigate();

  const storedUser = sessionStorage.getItem("user");

  let currentUser = null;

  try {
    currentUser = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    currentUser = null;
  }

  const savedContext = getWorkContext();

  const [site, setSite] = useState(savedContext?.site || "");

  const [client, setClient] = useState(savedContext?.client || "");

  const [machine, setMachine] = useState(savedContext?.machine || "");

  const [referenceCarte, setReferenceCarte] = useState(savedContext?.referenceCarte || "");

  const [clients, setClients] = useState([]);
  const [machines, setMachines] = useState([]);
  const [sites, setSites] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(true);
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  useEffect(() => {
    const chargerDonnees = async () => {
      setLoading(true);

      try {
        const [clientsData, machinesData, sitesData] =
          await Promise.all([
            getClients(),
            getMachines(),
            getSites(),
          ]);

        setClients(clientsData);
        setMachines(machinesData);
        setSites(sitesData);
      } catch (error) {
        setMessageType("error");
        setMessage(error.response?.data?.detail || "Erreur lors du chargement des données.");
      } finally {
        setLoading(false);
      }
    };
    chargerDonnees();
  }, []);



  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };




  const contexteComplet = () => {
    return (
      site &&
      client &&
      machine &&
      referenceCarte.trim()
    );
  };

  const verifierEtSauvegarderContexte = async () => {
    if (!contexteComplet()) {
      setMessageType("error");

      setMessage(
        "Veuillez sélectionner le site, le client, la machine et scanner la référence carte."
      );

      return null;
    }

    setVerificationEnCours(true);
    setMessage("");

    try {
      const carteResult = await checkCarteReference(
        referenceCarte.trim(),
        client.trim()
      );

      if (!carteResult.valid) {
        setMessageType("error");

        setMessage(
          carteResult.message ||
          "Cette référence carte n'appartient pas au client sélectionné."
        );

        return null;
      }

      const context = saveWorkContext({
        site,
        client,
        machine,
        referenceCarte,
      });

      return context;
    } catch (error) {
      setMessageType("error");

      setMessage(
        error.response?.data?.detail ||
        "Erreur lors de la vérification du contexte de travail."
      );

      return null;
    } finally {
      setVerificationEnCours(false);
    }
  };

  const ouvrirSuivi = async () => {
    const context = await verifierEtSauvegarderContexte();
    if (!context) {
      return;
    }
    navigate("/plan-chargement-mydata");
  };

  const verifierSuiviEtNaviguer = async (destination) => {
    const context = await verifierEtSauvegarderContexte();
    if (!context) {
      return;
    }
    setVerificationEnCours(true);
    try {
      const result =
        await getHistoriqueContexteAujourdHui(context);

      if (!result.suivi_existe) {
        setMessageType("warning");

        setMessage(
          "Aucun suivi n’a été effectué aujourd’hui pour ce site, ce client, cette machine et cette référence carte."
        );

        return;
      }

      navigate(destination);
    } catch (error) {
      setMessageType("error");

      setMessage(
        error.response?.data?.detail ||
        "Impossible de vérifier le suivi de ce contexte."
      );
    } finally {
      setVerificationEnCours(false);
    }
  };

  const handleContextChange = (setter) => {
    return (event) => {
      setter(event.target.value);
      setMessage("");
      setMessageType("");
    };
  };

  const handleReferenceKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    ouvrirSuivi();
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div>
          <h1 className="home-title">Cofitel</h1>

          <p className="home-welcome">
            Bonjour{" "}
            <strong>
              {currentUser?.username || "Utilisateur"}
            </strong>
          </p>
        </div>

        <button
          className="home-logout"
          type="button"
          onClick={handleLogout}
        >
          Déconnexion
        </button>
      </header>

      <main className="home-content">
        <section className="home-context-card">
          <div className="home-context-heading">
            <h2>Contexte de travail</h2>

            <p>
              Sélectionnez les informations de production
              avant de commencer une opération.
            </p>
          </div>

          {message && (
            <div
              className={`home-message ${messageType}`}
            >
              {message}
            </div>
          )}

          <div className="home-context-grid">
            <div className="home-field">
              <label htmlFor="site">Site</label>

              <select
                id="site"
                value={site}
                disabled={
                  loading || verificationEnCours
                }
                onChange={handleContextChange(setSite)}
              >
                <option value="">
                  -- Choisir un site --
                </option>

                {sites.map((item) => (
                  <option
                    key={item.id}
                    value={item.name}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-field">
              <label htmlFor="client">Client</label>

              <select
                id="client"
                value={client}
                disabled={
                  loading || verificationEnCours
                }
                onChange={handleContextChange(setClient)}
              >
                <option value="">
                  -- Choisir un client --
                </option>

                {clients.map((item) => (
                  <option
                    key={item.id}
                    value={item.nom}
                  >
                    {item.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-field">
              <label htmlFor="machine">Machine</label>

              <select
                id="machine"
                value={machine}
                disabled={
                  loading || verificationEnCours
                }
                onChange={handleContextChange(setMachine)}
              >
                <option value="">
                  -- Choisir une machine --
                </option>

                {machines.map((item) => (
                  <option
                    key={item.nom}
                    value={item.nom}
                  >
                    {item.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="home-field">
              <label htmlFor="reference-carte">
                Référence carte
              </label>

              <input
                id="reference-carte"
                type="text"
                value={referenceCarte}
                placeholder="Scanner la référence carte"
                disabled={
                  loading || verificationEnCours
                }
                onChange={handleContextChange(
                  setReferenceCarte
                )}
                onKeyDown={handleReferenceKeyDown}
              />
            </div>
          </div>
        </section>

        <section className="home-actions-card">
          <h2>Opérations</h2>

          <div className="home-buttons">
            <button
              className="home-button home-button-primary"
              type="button"
              disabled={
                loading ||
                verificationEnCours ||
                !contexteComplet()
              }
              onClick={ouvrirSuivi}
            >
              Suivi du plan de chargement
            </button>

            <button
              className="home-button"
              type="button"
              disabled={
                loading ||
                verificationEnCours ||
                !contexteComplet()
              }
              onClick={() =>
                verifierSuiviEtNaviguer(
                  "/reordonnancement"
                )
              }
            >
              Réordonnancement
            </button>

            <button
              className="home-button"
              type="button"
              disabled={
                loading ||
                verificationEnCours ||
                !contexteComplet()
              }
              onClick={() =>
                verifierSuiviEtNaviguer(
                  "/raboutage-rechargement"
                )
              }
            >
              Raboutage / Rechargement
            </button>
          </div>

          {verificationEnCours && (
            <p className="home-verification">
              Vérification du contexte en cours...
            </p>
          )}
        </section>
      </main>
    </div>
  );
}