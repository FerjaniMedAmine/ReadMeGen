import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

function getDefaultRoute(role) {
  switch (role?.toLowerCase()) {
    case "admin":
      return "/admin";

    case "controleur":
      return "/controle-qualite";

    case "operateur":
      return "/";

    default:
      return "/login";
  }
}

function ProtectedRoute({ requiredRole }) {
  const location = useLocation();

  const token = sessionStorage.getItem("access_token");
  const storedUser = sessionStorage.getItem("user");

  if (!token || !storedUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  let user;

  try {
    user = JSON.parse(storedUser);
  } catch {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");

    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role?.toLowerCase();

  if (!userRole) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");

    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole)
      ? requiredRole.map((role) => role.toLowerCase())
      : [requiredRole.toLowerCase()];

    /*
     * Admin can access every protected route.
     * Other users must have one of the required roles.
     */
    const isAuthorized =
      userRole === "admin" ||
      allowedRoles.includes(userRole);

    if (!isAuthorized) {
      return (
        <Navigate
          to={getDefaultRoute(userRole)}
          replace
        />
      );
    }
  }

  return <Outlet />;
}

export default ProtectedRoute;