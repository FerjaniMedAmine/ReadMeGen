import "./HistoriqueTable.css";


export default function HistoriqueTable({
  lignes = [],
  loading = false,
  title = "Historique du contexte",
}) {
  return (
    <section className="shared-history">
      <div className="shared-history-header">
        <h2>{title}</h2>

        <span className="shared-history-count">
          {lignes.length} ligne{lignes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="shared-history-table-container">
        <table className="shared-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opération</th>
              <th>Conducteur</th>
              <th>Bobine</th>
              <th>Feeder</th>
              <th>Slot</th>
              <th>Position</th>
              <th>Face</th>
              <th>Commentaire</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  className="shared-history-status"
                  colSpan="9"
                >
                  Chargement de l’historique...
                </td>
              </tr>
            ) : lignes.length === 0 ? (
              <tr>
                <td
                  className="shared-history-status"
                  colSpan="9"
                >
                  Aucun historique enregistré aujourd’hui pour ce
                  contexte.
                </td>
              </tr>
            ) : (
              lignes.map((ligne) => (
                <tr key={ligne.id}>
                  <td>
                    {new Date(ligne.date).toLocaleString()}
                  </td>

                  <td>{ligne.type_operation}</td>
                  <td>{ligne.conducteur}</td>
                  <td>{ligne.reference_bobine}</td>
                  <td>{ligne.reference_feeder}</td>
                  <td>{ligne.numero_slot}</td>
                  <td>{ligne.position_feeder}</td>
                  <td>{ligne.face || "—"}</td>
                  <td>{ligne.commentaire || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
