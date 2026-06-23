import type { Permission } from "./permissions";
import { PERMISSIONS } from "./permissions";

export type UserRole = "super_admin" | "district_officer" | "station_officer" | "crime_analyst";
export type AccessScopeType = "statewide" | "district" | "station";
export type ThemeDensity = "compact" | "comfortable";

export interface UserAccessScope {
  type: AccessScopeType;
  district: string;
  police_station: string;
}

export interface UserPreferences {
  defaultDataset: string;
  defaultTimeRange: "all" | "latest";
  defaultMapMode: "statewide" | "district" | "station" | "analytics";
  reportFormat: string;
  themeDensity: ThemeDensity;
}

export interface CrimePulseUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  assignedDistrict?: string;
  assignedPoliceStation?: string;
  accessScope: UserAccessScope;
  defaultRoute: string;
  allowedModules: string[];
  preferences: UserPreferences;
  permissions: Permission[];
  source: "demo" | "catalyst";
}

const allPermissions = Object.values(PERMISSIONS);
export const analystPermissions: Permission[] = [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_CRIME_RECORDS, PERMISSIONS.VIEW_ALL_DISTRICTS, PERMISSIONS.VIEW_DISTRICT_RISK, PERMISSIONS.VIEW_ALERTS, PERMISSIONS.VIEW_PATTERN_DISCOVERY, PERMISSIONS.VIEW_HOTSPOT_MAP, PERMISSIONS.VIEW_TIME_MACHINE, PERMISSIONS.VIEW_FORECAST, PERMISSIONS.VIEW_SOCIO_ECONOMIC, PERMISSIONS.VIEW_DISTRICT_ANALYTICS, PERMISSIONS.VIEW_RISK_INTELLIGENCE, PERMISSIONS.VIEW_AI_INSIGHTS, PERMISSIONS.GENERATE_REPORTS, PERMISSIONS.EXPORT_REPORTS, PERMISSIONS.VIEW_PRESENTATION_MODE];

export const demoUsers: Array<CrimePulseUser & { password: string }> = [
  { id: "u-admin", name: "CrimePulse Admin", email: "admin@crimepulse.ai", password: "Admin@123", role: "super_admin", roleLabel: "Super Admin", assignedDistrict: "All", assignedPoliceStation: "All", accessScope: { type: "statewide", district: "All", police_station: "All" }, defaultRoute: "/dashboard", allowedModules: ["all"], preferences: { defaultDataset: "all", defaultTimeRange: "all", defaultMapMode: "statewide", reportFormat: "full-intelligence-report", themeDensity: "comfortable" }, permissions: allPermissions, source: "demo" },
  { id: "u-district", name: "Bagalkot District Commander", email: "district@crimepulse.ai", password: "District@123", role: "district_officer", roleLabel: "District Command Officer", assignedDistrict: "Bagalkot", assignedPoliceStation: "All", accessScope: { type: "district", district: "Bagalkot", police_station: "All" }, defaultRoute: "/district-risk-dna", allowedModules: ["dashboard", "records", "district-risk-dna", "alerts", "hotspot-map", "crime-forecast", "district-analytics", "risk-intelligence", "ai-insights", "reports", "presentation-mode"], preferences: { defaultDataset: "all", defaultTimeRange: "latest", defaultMapMode: "district", reportFormat: "district-report", themeDensity: "comfortable" }, permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_CRIME_RECORDS, PERMISSIONS.VIEW_ASSIGNED_DISTRICT, PERMISSIONS.VIEW_DISTRICT_RISK, PERMISSIONS.VIEW_ALERTS, PERMISSIONS.VIEW_HOTSPOT_MAP, PERMISSIONS.VIEW_FORECAST, PERMISSIONS.VIEW_DISTRICT_ANALYTICS, PERMISSIONS.VIEW_RISK_INTELLIGENCE, PERMISSIONS.VIEW_AI_INSIGHTS, PERMISSIONS.GENERATE_REPORTS, PERMISSIONS.EXPORT_REPORTS, PERMISSIONS.VIEW_PRESENTATION_MODE], source: "demo" },
  { id: "u-station", name: "Amengad Station Officer", email: "station@crimepulse.ai", password: "Station@123", role: "station_officer", roleLabel: "Police Station Officer", assignedDistrict: "Bagalkot", assignedPoliceStation: "Amengad PS", accessScope: { type: "station", district: "Bagalkot", police_station: "Amengad PS" }, defaultRoute: "/alerts", allowedModules: ["dashboard", "records", "alerts", "hotspot-map", "crime-forecast", "risk-intelligence", "reports", "presentation-mode"], preferences: { defaultDataset: "all", defaultTimeRange: "latest", defaultMapMode: "station", reportFormat: "station-report", themeDensity: "compact" }, permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_CRIME_RECORDS, PERMISSIONS.VIEW_ASSIGNED_STATION, PERMISSIONS.VIEW_ALERTS, PERMISSIONS.VIEW_HOTSPOT_MAP, PERMISSIONS.VIEW_RISK_INTELLIGENCE, PERMISSIONS.VIEW_FORECAST, PERMISSIONS.GENERATE_REPORTS, PERMISSIONS.EXPORT_REPORTS, PERMISSIONS.VIEW_PRESENTATION_MODE], source: "demo" },
  { id: "u-analyst", name: "Crime Intelligence Analyst", email: "analyst@crimepulse.ai", password: "Analyst@123", role: "crime_analyst", roleLabel: "Crime Analyst", assignedDistrict: "All", assignedPoliceStation: "All", accessScope: { type: "statewide", district: "All", police_station: "All" }, defaultRoute: "/pattern-discovery", allowedModules: ["dashboard", "records", "pattern-discovery", "crime-time-machine", "crime-forecast", "socio-economic-insights", "district-analytics", "risk-intelligence", "ai-insights", "ai-report", "reports", "presentation-mode"], preferences: { defaultDataset: "all", defaultTimeRange: "all", defaultMapMode: "analytics", reportFormat: "full-intelligence-report", themeDensity: "comfortable" }, permissions: analystPermissions, source: "demo" }
];

export const findDemoUser = (email: string, password: string) => demoUsers.find((user) => user.email === email.trim().toLowerCase() && user.password === password);

export const normalizeCrimePulseUser = (user: Partial<CrimePulseUser> | null): CrimePulseUser | null => {
  if (!user?.email) return null;
  const demo = demoUsers.find((candidate) => candidate.email === user.email);
  if (demo) {
    const { password: _password, ...profile } = demo;
    return { ...profile, preferences: { ...profile.preferences, ...(user.preferences || {}) } };
  }
  return {
    id: user.id || `user-${user.email}`,
    name: user.name || user.email,
    email: user.email,
    role: user.role || "crime_analyst",
    roleLabel: user.roleLabel || "Crime Analyst",
    assignedDistrict: user.assignedDistrict || "All",
    assignedPoliceStation: user.assignedPoliceStation || "All",
    accessScope: user.accessScope || { type: "statewide", district: "All", police_station: "All" },
    defaultRoute: user.defaultRoute || "/dashboard",
    allowedModules: user.allowedModules || ["all"],
    preferences: { defaultDataset: "all", defaultTimeRange: "all", defaultMapMode: "analytics", reportFormat: "full-intelligence-report", themeDensity: "comfortable", ...(user.preferences || {}) },
    permissions: user.permissions || analystPermissions,
    source: user.source || "demo"
  };
};
