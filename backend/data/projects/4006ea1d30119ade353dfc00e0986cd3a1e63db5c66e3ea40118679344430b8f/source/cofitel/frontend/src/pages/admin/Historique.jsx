import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHistorique } from "../../services/historiqueService";
import "../styles/admin/Historique.css";

export default function Historique() {
  const navigate = useNavigate();

  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const chargerHistorique = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getHistorique();
      setHistorique(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Impossible de charger l'historique."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerHistorique();
  }, []);

  const exporterExcel = async () => {
    if (historique.length === 0 || exporting) {
      return;
    }

    setExporting(true);
    setError("");

    try {
      // Loaded only when the user requests an export.
      const XLSX = await import("xlsx");

      const donneesExcel = historique.map((ligne) => ({
        Date: ligne.date ? new Date(ligne.date) : "",
        Type: ligne.type_operation ?? "",
        Site: ligne.site ?? "",
        Client: ligne.client ?? "",
        Conducteur: ligne.conducteur ?? "",
        Machine: ligne.machine ?? "",
        Carte: ligne.reference_carte ?? "",
        Bobine: ligne.reference_bobine ?? "",
        Feeder: ligne.reference_feeder ?? "",
        Slot: ligne.numero_slot ?? "",
        Position: ligne.position_feeder ?? "",
        Face: ligne.face ?? "",
        Commentaire: ligne.commentaire ?? "",
      }));

      const feuille = XLSX.utils.json_to_sheet(donneesExcel, {
        cellDates: true,
      });


      feuille["!cols"] = [
        { wch: 22 }, // Date
        { wch: 18 }, // Type
        { wch: 18 }, // Site
        { wch: 24 }, // Client
        { wch: 24 }, // Conducteur
        { wch: 20 }, // Machine
        { wch: 20 }, // Carte
        { wch: 20 }, // Bobine
        { wch: 20 }, // Feeder
        { wch: 12 }, // Slot
        { wch: 14 }, // Position
        { wch: 12 }, // Face
        { wch: 40 }, // Commentaire
      ];

      const classeur = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        classeur,
        feuille,
        "Historique"
      );

      const dateExport = new Date().toISOString().slice(0, 10);

      XLSX.writeFile(
        classeur,
        `historique_${dateExport}.xlsx`,
        {
          compression: true,
        }
      );
    } catch (err) {
      console.error("Erreur lors de l'export Excel :", err);
      setError("Impossible d'exporter l'historique au format Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="historique-container">
      <div className="historique-header">
        <button
          type="button"
          className="historique-back"
          onClick={() => navigate("/admin")}
        >
          ← Retour
        </button>

        <h1 className="historique-title">Historique</h1>

        <button
          type="button"
          className="historique-export"
          onClick={exporterExcel}
          disabled={loading || exporting || historique.length === 0}
        >
          {exporting ? "Exportation..." : "Exporter vers Excel"}
        </button>
      </div>

      {error && <div className="historique-error">{error}</div>}

      {loading ? (
        <p className="historique-loading">
          Chargement de l'historique...
        </p>
      ) : historique.length === 0 ? (
        <p className="historique-empty">
          Aucun historique enregistré.
        </p>
      ) : (
        <div className="historique-table-container">
          <table className="historique-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Site</th>
                <th>Client</th>
                <th>Conducteur</th>
                <th>Machine</th>
                <th>Carte</th>
                <th>Bobine</th>
                <th>Feeder</th>
                <th>Slot</th>
                <th>Position</th>
                <th>Face</th>
                <th>Commentaire</th>
              </tr>
            </thead>

            <tbody>
              {historique.map((ligne) => (
                <tr key={ligne.id}>
                  <td>
                    {ligne.date
                      ? new Date(ligne.date).toLocaleString()
                      : ""}
                  </td>
                  <td>{ligne.type_operation}</td>
                  <td>{ligne.site}</td>
                  <td>{ligne.client}</td>
                  <td>{ligne.conducteur}</td>
                  <td>{ligne.machine}</td>
                  <td>{ligne.reference_carte}</td>
                  <td>{ligne.reference_bobine}</td>
                  <td>{ligne.reference_feeder}</td>
                  <td>{ligne.numero_slot}</td>
                  <td>{ligne.position_feeder}</td>
                  <td>{ligne.face}</td>
                  <td>{ligne.commentaire}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
