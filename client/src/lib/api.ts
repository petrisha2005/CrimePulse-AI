import { applyUserScopeToParams } from "../auth/accessScope";
import { normalizeCrimePulseUser, type CrimePulseUser } from "../auth/users";

const AUTH_STORAGE_KEY = "crimepulse_auth_user";

export const getStoredAuthUser = (): CrimePulseUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? normalizeCrimePulseUser(JSON.parse(raw) as CrimePulseUser) : null;
  } catch {
    return null;
  }
};

export const withUserScope = <T extends Record<string, unknown>>(params: T, user = getStoredAuthUser()) =>
  applyUserScopeToParams(user, params);

export const scopedApiUrl = (input: string, user = getStoredAuthUser()) => {
  const url = new URL(input, window.location.origin);
  Object.entries(withUserScope({}, user)).forEach(([key, value]) => url.searchParams.set(key, value));
  return input.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
};
