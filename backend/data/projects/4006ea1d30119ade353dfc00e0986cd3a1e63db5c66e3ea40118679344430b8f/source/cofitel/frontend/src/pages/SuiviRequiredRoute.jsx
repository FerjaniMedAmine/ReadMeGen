import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import {
  getHistoriqueContexteAujourdHui,
} from "../services/historiqueService";

import {
  getWorkContext,
} from "../services/workContextService";

export default function SuiviRequiredRoute() {
  const [loading, setLoading] = useState(true);
  const [autorise, setAutorise] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const verifierAcces = async () => {
      const context = getWorkContext();

      if (!context) {
        if (active) {
          setMessage(
            "Veuillez d’abord sélectionner un contexte de travail."
          );

          setLoading(false);
        }

        return;
      }

      try {
        const result =
          await getHistoriqueContexteAujourdHui(context);

        if (!active) {
          return;
        }

        if (result.suivi_existe) {
          setAutorise(true);
        } else {
          setMessage(
            "Aucun suivi n’a été effectué aujourd’hui pour ce site, ce client, cette machine et cette référence carte."
          );
        }
      } catch (error) {
        if (active) {
          setMessage(
            error.response?.data?.detail ||
              "Impossible de vérifier le suivi du contexte sélectionné."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    verifierAcces();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="route-verification">
        Vérification du contexte de travail...
      </div>
    );
  }

  if (!autorise) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          accessMessage: message,
        }}
      />
    );
  }

  return <Outlet />;
}