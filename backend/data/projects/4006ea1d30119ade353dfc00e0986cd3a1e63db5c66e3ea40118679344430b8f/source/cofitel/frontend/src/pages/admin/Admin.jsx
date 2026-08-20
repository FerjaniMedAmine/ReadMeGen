import { useNavigate } from "react-router-dom";
import "../styles/admin/Admin.css";
import adminBg from "../../assets/admin.jpg";

function Admin() {
  const navigate = useNavigate();

  return (
    <div
      className="admin-container"
      style={{ backgroundImage: `url(${adminBg})` }}
    >
      <div className="admin-overlay">
        <h1 className="admin-title">Administration</h1>

        <div className="admin-actions">
          <button
            className="btn btn-machines"
            onClick={() => navigate("/admin/gestion-machines")}
          >
            Gestion des machines
          </button>

          <button
            className="btn btn-operateurs"
            onClick={() => navigate("/admin/gestion-operateurs")}
          >
            Gestion des utilisateurs
          </button>

          <button
            className="btn btn-clients"
            onClick={() => navigate("/admin/gestion-clients")}
          >
            Gestion des clients
          </button>

          <button
            className="btn btn-historique"
            onClick={() => navigate("/admin/historique")}
          >
            Historique
          </button>

          <button
            className="btn btn-ilots"
            onClick={() => navigate("/admin/gestion-ilots")}
          >
            Gestion des îlots
          </button>

          <button
            className="btn btn-produits-defectueux"
            onClick={() => navigate("/admin/produits-defectueux")}
          >
            Produits défectueux
          </button>


        </div>
      </div>
    </div>
  );
}

export default Admin;