import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Home from "./pages/operateur/home";
import Reordonnancement from "./pages/operateur/Reordonnancement";
import RaboutageRechargement from "./pages/operateur/RaboutageRechargement";
import PlanChargementMydata from "./pages/operateur/PlanChargementMydata";

import Admin from "./pages/admin/Admin";
import GestionMachines from "./pages/admin/GestionMachines";
import GestionOperateurs from "./pages/admin/GestionOperateurs";
import GestionClients from "./pages/admin/GestionClients";
import GestionCartesClient from "./pages/admin/GestionCartesClient";
import GestionGuideCarte from "./pages/admin/GestionGuideCarte";
import Historique from "./pages/admin/Historique";

import Login from "./pages/login";
import ProtectedRoute from "./pages/ProtectedRoute";
import SuiviRequiredRoute from "./pages/SuiviRequiredRoute";

import GestionIlots from "./pages/admin/GestionIlots";
import GestionPostesDetection from "./pages/admin/GestionPostesDetection";
import GestionTypesDefaut from "./pages/admin/GestionTypesDefaut";
import GestionCodesErreur from "./pages/admin/GestionCodesErreur";

import ControleQualite from "./pages/controleur/ControleQualite";
import ControleParametres from "./pages/controleur/ControleParametres";
import AnalyseQualite from "./pages/controleur/AnalyseQualite";
import SaisieDefauts from "./pages/controleur/SaisieDefauts";
import QuantiteControlee from "./pages/controleur/QuantiteControlee";
import ProduitsDefectueux from "./pages/admin/ProduitsDefectueux";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/*
          Operator routes

          Accessible by:
          - operateur
          - admin
        */}
        <Route
          element={
            <ProtectedRoute requiredRole="operateur" />
          }
        >
          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/plan-chargement-mydata"
            element={<PlanChargementMydata />}
          />


          <Route element={<SuiviRequiredRoute />}>
            <Route
              path="/reordonnancement"
              element={<Reordonnancement />}
            />

            <Route
              path="/raboutage-rechargement"
              element={<RaboutageRechargement />}
            />
          </Route>
        </Route>

        {/*
          Admin routes

          Accessible only by:
          - admin
        */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin" />
          }
        >
          <Route
            path="/admin"
            element={<Admin />}
          />

          <Route
            path="/admin/gestion-machines"
            element={<GestionMachines />}
          />

          <Route
            path="/admin/gestion-operateurs"
            element={<GestionOperateurs />}
          />

          <Route
            path="/admin/gestion-clients"
            element={<GestionClients />}
          />

          <Route
            path="/admin/gestion-clients/:id/cartes"
            element={<GestionCartesClient />}
          />

          <Route
            path="/admin/guide-carte"
            element={<GestionGuideCarte />}
          />

          <Route
            path="/admin/historique"
            element={<Historique />}
          />

          <Route
            path="/admin/gestion-ilots"
            element={<GestionIlots />}
          />

          <Route
            path="/admin/gestion-ilots/:ilotId/postes"
            element={<GestionPostesDetection />}
          />

          <Route
            path="/admin/gestion-ilots/:ilotId/postes/:posteId/types-defaut"
            element={<GestionTypesDefaut />}
          />

          <Route
            path="/admin/gestion-ilots/:ilotId/postes/:posteId/types-defaut/:typeId/codes-erreur"
            element={<GestionCodesErreur />}
          />

          <Route
            path="/admin/produits-defectueux"
            element={<ProduitsDefectueux />}
          />
        </Route>

        {/*
          Quality-control routes

          Accessible by:
          - controleur
          - admin
        */}
        <Route
          element={
            <ProtectedRoute
              requiredRole={["controleur", "admin"]}
            />
          }
        >
          <Route
            path="/controle-qualite"
            element={<ControleQualite />}
          />

          <Route
            path="/controle-qualite/ControleParametres"
            element={<ControleParametres />}
          />

          <Route
            path="/controle-qualite/analyse"
            element={<AnalyseQualite />}
          />

          <Route
            path="/controle-qualite/ControleParametres/SaisieDefauts"
            element={<SaisieDefauts />}
          />
          <Route
            path="/controle-qualite/quantite-controlee"
            element={<QuantiteControlee />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;