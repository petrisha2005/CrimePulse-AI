import { analystPermissions, findDemoUser, normalizeCrimePulseUser, type CrimePulseUser } from "../auth/users";
import { withRouterBase } from "../utils/routerBase";

export type AuthUser = CrimePulseUser;

interface LoginResult { success: boolean; user?: AuthUser; message?: string; }

declare global {
  interface Window {
    catalyst?: {
      init: (config: { project_Id: string; zaid?: string; environment?: string }) => void;
      auth: { signIn: (redirectUrl?: string) => void; signOut: (redirectUrl?: string) => void; isUserAuthenticated: () => Promise<boolean>; getCurrentUser: () => Promise<{ first_name?: string; last_name?: string; email_id?: string }>; };
    };
  }
}

const AUTH_STORAGE_KEY = "crimepulse_auth_user";
let initialized = false;

export const initCatalyst = () => {
  if (initialized || !window.catalyst) return;
  // TODO: Replace demo credential validation with Catalyst Authentication role claims in production.
  const projectId = import.meta.env.VITE_CATALYST_PROJECT_ID;
  if (!projectId) return;
  window.catalyst.init({ project_Id: projectId, environment: import.meta.env.VITE_CATALYST_ENVIRONMENT || "Development" });
  initialized = true;
};

const catalystConfigured = () => Boolean(import.meta.env.VITE_CATALYST_PROJECT_ID && window.catalyst);
const readStoredUser = (): AuthUser | null => {
  try { const raw = localStorage.getItem(AUTH_STORAGE_KEY); return raw ? normalizeCrimePulseUser(JSON.parse(raw) as AuthUser) : null; } catch { localStorage.removeItem(AUTH_STORAGE_KEY); return null; }
};
const storeUser = (user: AuthUser) => localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    // TODO: Replace this hackathon-only credential lookup with Catalyst Authentication.
    const demo = findDemoUser(email, password);
    if (demo) {
      const { password: _password, ...user } = demo;
      storeUser(user);
      return { success: true, user };
    }
    initCatalyst();
    // Catalyst sign-in is opt-in so an invalid demo credential never bypasses this login screen.
    if (import.meta.env.VITE_USE_CATALYST_AUTH === "true" && catalystConfigured()) {
      window.catalyst?.auth.signIn(`${window.location.origin}${withRouterBase("/dashboard")}`);
      return { success: true };
    }
    return { success: false, message: "Invalid demo credentials. Please select one of the authorized demo roles." };
  },
  async logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    initCatalyst();
    if (catalystConfigured()) window.catalyst?.auth.signOut(`${window.location.origin}${withRouterBase("/login")}`);
  },
  async getCurrentUser(): Promise<AuthUser | null> {
    const stored = readStoredUser();
    if (stored) return stored;
    initCatalyst();
    if (!catalystConfigured()) return null;
    try {
      const user = await window.catalyst?.auth.getCurrentUser();
      if (!user) return null;
      const currentUser: AuthUser = { id: `catalyst-${user.email_id}`, name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email_id || "Catalyst User", email: user.email_id || "", role: "crime_analyst", roleLabel: "Crime Analyst", assignedDistrict: "All", assignedPoliceStation: "All", accessScope: { type: "statewide", district: "All", police_station: "All" }, defaultRoute: "/pattern-discovery", allowedModules: ["dashboard", "upload", "records", "pattern-discovery", "crime-time-machine", "crime-forecast", "socio-economic-insights", "district-analytics", "risk-intelligence", "ai-insights", "ai-report", "reports", "presentation-mode"], preferences: { defaultDataset: "all", defaultTimeRange: "all", defaultMapMode: "analytics", reportFormat: "full-intelligence-report", themeDensity: "comfortable" }, permissions: analystPermissions, source: "catalyst" };
      storeUser(currentUser);
      return currentUser;
    } catch { return null; }
  },
  async checkAuthStatus() { return Boolean(await this.getCurrentUser()); }
};
