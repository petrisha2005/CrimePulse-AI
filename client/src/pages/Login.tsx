import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";

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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await authService.login(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.message || "Unable to sign in.");
      return;
    }

    navigate(from, { replace: true });
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-command-950 px-4 text-slate-100">
        <div className="rounded-md border border-command-700 bg-command-900/90 px-6 py-5 text-sm text-slate-300 shadow-glow">
          Checking secure session...
        </div>
      </main>
    );
  }

  if (authenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="grid min-h-screen bg-command-950 text-slate-100 lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r border-command-700 bg-command-900/80 px-10 py-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded border border-command-500 bg-command-850">
              <ShieldCheck className="h-7 w-7 text-command-300" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-command-300">Karnataka Police</p>
              <h1 className="text-2xl font-semibold text-white">CrimePulse AI</h1>
            </div>
          </div>

          <div className="mt-16 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-command-300">Secure Crime Intelligence</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">
              AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Authorized access for operational monitoring, crime data ingestion, and district-level command analytics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
          <div className="rounded border border-command-700 bg-command-850 p-4">Protected Dashboard</div>
          <div className="rounded border border-command-700 bg-command-850 p-4">Catalyst Auth</div>
          <div className="rounded border border-command-700 bg-command-850 p-4">Secure Data Flow</div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <form className="w-full max-w-md rounded-md border border-command-700 bg-command-900/95 p-7 shadow-glow" onSubmit={submit}>
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500 bg-command-850">
              <ShieldCheck className="h-6 w-6 text-command-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-command-300">Karnataka Police</p>
              <h1 className="text-xl font-semibold text-white">CrimePulse AI</h1>
            </div>
          </div>

          <div className="mt-8 lg:mt-0">
            <p className="text-sm uppercase tracking-[0.18em] text-command-300">Secure Access</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Command Login</h2>
            <p className="mt-2 text-sm text-slate-400">AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police</p>
          </div>

          <label className="mt-7 block text-sm font-medium text-slate-300">
            Email
            <div className="mt-2 flex items-center rounded-md border border-command-700 bg-command-850 px-3 focus-within:border-command-300">
              <Mail className="h-4 w-4 text-slate-500" />
              <input
                className="min-h-11 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="officer@crimepulse.gov.in"
                required
                type="email"
                value={email}
              />
            </div>
          </label>

          <label className="mt-5 block text-sm font-medium text-slate-300">
            Password
            <div className="mt-2 flex items-center rounded-md border border-command-700 bg-command-850 px-3 focus-within:border-command-300">
              <LockKeyhole className="h-4 w-4 text-slate-500" />
              <input
                className="min-h-11 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter secure password"
                required
                type="password"
                value={password}
              />
            </div>
          </label>

          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">Secure access only</span>
            <button className="text-command-300 hover:text-white" type="button">
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded border border-alert-critical/50 bg-alert-critical/10 px-3 py-2 text-sm text-alert-critical">
              {error}
            </div>
          )}

          <button
            className="mt-6 flex min-h-11 w-full items-center justify-center rounded-md bg-command-500 px-4 py-3 font-semibold text-white transition hover:bg-command-300 hover:text-command-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>

          <div className="mt-5 rounded border border-command-700 bg-command-850 px-3 py-3 text-xs leading-5 text-slate-400">
            Temporary demo mode for local testing: `officer@crimepulse.gov.in` / `CrimePulse@123`. Remove this fallback before production.
          </div>
        </form>
      </section>
    </main>
  );
};

export default Login;
