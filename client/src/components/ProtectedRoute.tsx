import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authService } from "../services/authService";
import StateBlock from "./StateBlock";

const ProtectedRoute = () => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    authService.checkAuthStatus().then((status) => {
      if (!active) return;
      setAuthenticated(status);
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return <StateBlock title="Checking secure session" message="Validating access before opening CrimePulse AI." />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
