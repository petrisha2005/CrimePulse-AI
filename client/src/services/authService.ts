import { withRouterBase } from "../utils/routerBase";

export interface AuthUser {
  name: string;
  email: string;
  source: "catalyst" | "demo";
}

interface LoginResult {
  success: boolean;
  user?: AuthUser;
  message?: string;
}

declare global {
  interface Window {
    catalyst?: {
      init: (config: { project_Id: string; zaid?: string; environment?: string }) => void;
      auth: {
        signIn: (redirectUrl?: string) => void;
        signOut: (redirectUrl?: string) => void;
        isUserAuthenticated: () => Promise<boolean>;
        getCurrentUser: () => Promise<{ first_name?: string; last_name?: string; email_id?: string }>;
      };
    };
  }
}

const DEMO_SESSION_KEY = "crimepulse_demo_auth";
const DEMO_EMAIL = "officer@crimepulse.gov.in";
const DEMO_PASSWORD = "CrimePulse@123";
let initialized = false;

export const initCatalyst = () => {
  if (initialized || !window.catalyst) return;

  // Configure VITE_CATALYST_PROJECT_ID after creating the project in Zoho Catalyst.
  // For production, remove demo mode below and rely only on Catalyst Authentication.
  const projectId = import.meta.env.VITE_CATALYST_PROJECT_ID;
  if (!projectId) return;

  window.catalyst.init({
    project_Id: projectId,
    environment: import.meta.env.VITE_CATALYST_ENVIRONMENT || "Development"
  });
  initialized = true;
};

const isCatalystConfigured = () => Boolean(import.meta.env.VITE_CATALYST_PROJECT_ID && window.catalyst);

const getDemoUser = (): AuthUser | null => {
  const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
};

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    initCatalyst();

    if (isCatalystConfigured()) {
      // Catalyst Authentication owns the secure credential exchange and session cookie.
      // The hosted Catalyst login screen will complete sign-in and redirect back here.
      window.catalyst?.auth.signIn(`${window.location.origin}${withRouterBase("/dashboard")}`);
      return { success: true };
    }

    // Temporary local demo mode for development preview only. Remove before production.
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const user: AuthUser = {
        name: "CrimePulse AI Demo Officer",
        email: DEMO_EMAIL,
        source: "demo"
      };
      sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
      return { success: true, user };
    }

    return {
      success: false,
      message: "Invalid credentials. Use Catalyst Authentication or the temporary demo account."
    };
  },

  async logout(): Promise<void> {
    initCatalyst();
    sessionStorage.removeItem(DEMO_SESSION_KEY);

    if (isCatalystConfigured()) {
      window.catalyst?.auth.signOut(`${window.location.origin}${withRouterBase("/login")}`);
      return;
    }

    window.location.assign(withRouterBase("/login"));
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    initCatalyst();
    const demoUser = getDemoUser();
    if (demoUser) return demoUser;

    if (!isCatalystConfigured()) return null;

    try {
      const catalystUser = await window.catalyst?.auth.getCurrentUser();
      if (!catalystUser) return null;
      const name = [catalystUser.first_name, catalystUser.last_name].filter(Boolean).join(" ");
      return {
        name: name || catalystUser.email_id || "Catalyst User",
        email: catalystUser.email_id || "",
        source: "catalyst"
      };
    } catch {
      return null;
    }
  },

  async checkAuthStatus(): Promise<boolean> {
    initCatalyst();
    if (getDemoUser()) return true;

    if (!isCatalystConfigured()) return false;

    try {
      return Boolean(await window.catalyst?.auth.isUserAuthenticated());
    } catch {
      return false;
    }
  }
};
