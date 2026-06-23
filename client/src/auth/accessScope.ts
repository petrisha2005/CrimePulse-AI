import type { CrimeRecord } from "../types/crime";
import type { CrimePulseUser } from "./users";

const hasScopedValue = (value?: string) => Boolean(value && value !== "All");

export const getUserScopeParams = (user: CrimePulseUser | null): Record<string, string> => {
  if (!user || !user.accessScope || user.accessScope.type === "statewide") return {};
  const params: Record<string, string> = {};
  if (hasScopedValue(user.accessScope.district)) params.district = user.accessScope.district;
  if (user.accessScope.type === "station" && hasScopedValue(user.accessScope.police_station)) {
    params.police_station = user.accessScope.police_station;
  }
  return params;
};

export const canAccessModule = (user: CrimePulseUser | null, moduleKey: string) =>
  Boolean(user && (!user.allowedModules || user.allowedModules.includes("all") || user.allowedModules.includes(moduleKey)));

export const canViewRecord = (user: CrimePulseUser | null, record: Pick<CrimeRecord, "district" | "police_station">) => {
  if (!user || !user.accessScope || user.accessScope.type === "statewide") return Boolean(user);
  if (record.district !== user.accessScope.district) return false;
  return user.accessScope.type !== "station" || record.police_station === user.accessScope.police_station;
};

export const applyUserScopeToParams = <T extends Record<string, unknown>>(user: CrimePulseUser | null, params: T): T & Record<string, string> =>
  ({ ...params, ...getUserScopeParams(user) } as T & Record<string, string>);

export const getScopeLabel = (user: CrimePulseUser | null) => {
  if (!user || !user.accessScope || user.accessScope.type === "statewide") return user?.role === "crime_analyst" ? "Analytics Access" : "Statewide Access";
  if (user.accessScope.type === "station") return `Station: ${user.accessScope.police_station}`;
  return `District: ${user.accessScope.district}`;
};
