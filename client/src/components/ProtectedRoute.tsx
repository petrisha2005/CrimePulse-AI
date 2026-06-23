import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { routeModules, routePermissions } from "../auth/permissions";
import { useAuth } from "../auth/AuthContext";
import RoleBadge from "./auth/RoleBadge";
import StateBlock from "./StateBlock";

const ProtectedRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, loading, canAccessRoute } = useAuth();
  const required = routePermissions[location.pathname];
  const moduleKey = routeModules[location.pathname];

  if (loading) return <StateBlock title="Checking secure session" message="Validating access before opening CrimePulse AI." />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!canAccessRoute(location.pathname)) {
    return <main className="flex min-h-[60vh] items-center justify-center px-4"><section className="card-safe w-full max-w-lg border border-alert-high/40 bg-command-900 p-7 shadow-glow"><p className="text-sm uppercase tracking-[0.18em] text-alert-high">Access Restricted</p><h1 className="mt-2 text-2xl font-semibold text-white">This module is not available for your role.</h1><p className="mt-3 text-sm leading-6 text-slate-300">Your role does not have permission to access this module.</p><div className="mt-5 flex flex-wrap items-center gap-3"><RoleBadge role={currentUser!.role} label={currentUser!.roleLabel} /><span className="text-xs text-slate-500">Required module: {moduleKey || required || "Authorized access"}</span></div><button className="mt-6 min-h-11 bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => navigate(currentUser!.defaultRoute || "/dashboard")} type="button">Go to My Dashboard</button></section></main>;
  }
  return <Outlet />;
};

export default ProtectedRoute;
