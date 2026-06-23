import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import type { Permission } from "./permissions";
import { routeModules, routePermissions } from "./permissions";
import { canAccessModule, getUserScopeParams } from "./accessScope";
import type { CrimePulseUser, UserPreferences } from "./users";

interface AuthContextValue {
  currentUser: CrimePulseUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: CrimePulseUser }>;
  logout: () => Promise<void>;
  hasPermission: (permission?: Permission) => boolean;
  canAccessRoute: (route: string) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  scopeParams: Record<string, string>;
  preferences: UserPreferences | null;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  assignedDistrict?: string;
  assignedPoliceStation?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const preferenceKey = (userId: string) => `crimepulse_user_preferences_${userId}`;

const loadPreferences = (user: CrimePulseUser | null): UserPreferences | null => {
  if (!user) return null;
  try {
    const saved = localStorage.getItem(preferenceKey(user.id));
    return { ...user.preferences, ...(saved ? JSON.parse(saved) : {}) };
  } catch {
    return user.preferences;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<CrimePulseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      setCurrentUser(user);
      setPreferences(loadPreferences(user));
    }).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    isAuthenticated: Boolean(currentUser),
    loading,
    login: async (email, password) => {
      const result = await authService.login(email, password);
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setPreferences(loadPreferences(result.user));
      }
      return result;
    },
    logout: async () => { await authService.logout(); setCurrentUser(null); setPreferences(null); },
    hasPermission: (permission) => !permission || Boolean(currentUser?.permissions.includes(permission)),
    canAccessRoute: (route) => {
      const permissionAllowed = !routePermissions[route] || Boolean(currentUser?.permissions.includes(routePermissions[route]));
      const moduleKey = routeModules[route];
      return permissionAllowed && (!moduleKey || canAccessModule(currentUser, moduleKey));
    },
    canAccessModule: (moduleKey) => canAccessModule(currentUser, moduleKey),
    scopeParams: getUserScopeParams(currentUser),
    preferences,
    updatePreferences: (updates) => {
      if (!currentUser) return;
      const next = { ...(preferences || currentUser.preferences), ...updates };
      localStorage.setItem(preferenceKey(currentUser.id), JSON.stringify(next));
      setPreferences(next);
    },
    assignedDistrict: currentUser?.assignedDistrict,
    assignedPoliceStation: currentUser?.assignedPoliceStation
  }), [currentUser, loading, preferences]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
