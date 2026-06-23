export const PERMISSIONS = {
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  UPLOAD_DATA: "UPLOAD_DATA",
  REPLACE_DATASET: "REPLACE_DATASET",
  DELETE_DATASET: "DELETE_DATASET",
  VIEW_CRIME_RECORDS: "VIEW_CRIME_RECORDS",
  VIEW_ALL_DISTRICTS: "VIEW_ALL_DISTRICTS",
  VIEW_ASSIGNED_DISTRICT: "VIEW_ASSIGNED_DISTRICT",
  VIEW_ASSIGNED_STATION: "VIEW_ASSIGNED_STATION",
  VIEW_DISTRICT_RISK: "VIEW_DISTRICT_RISK",
  VIEW_ALERTS: "VIEW_ALERTS",
  VIEW_PATTERN_DISCOVERY: "VIEW_PATTERN_DISCOVERY",
  VIEW_HOTSPOT_MAP: "VIEW_HOTSPOT_MAP",
  VIEW_TIME_MACHINE: "VIEW_TIME_MACHINE",
  VIEW_FORECAST: "VIEW_FORECAST",
  VIEW_SOCIO_ECONOMIC: "VIEW_SOCIO_ECONOMIC",
  VIEW_DISTRICT_ANALYTICS: "VIEW_DISTRICT_ANALYTICS",
  VIEW_RISK_INTELLIGENCE: "VIEW_RISK_INTELLIGENCE",
  VIEW_AI_INSIGHTS: "VIEW_AI_INSIGHTS",
  GENERATE_REPORTS: "GENERATE_REPORTS",
  EXPORT_REPORTS: "EXPORT_REPORTS",
  MANAGE_USERS: "MANAGE_USERS",
  VIEW_DIAGNOSTICS: "VIEW_DIAGNOSTICS",
  VIEW_PRESENTATION_MODE: "VIEW_PRESENTATION_MODE"
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const routePermissions: Record<string, Permission> = {
  "/dashboard": PERMISSIONS.VIEW_DASHBOARD,
  "/upload": PERMISSIONS.UPLOAD_DATA,
  "/records": PERMISSIONS.VIEW_CRIME_RECORDS,
  "/district-risk-dna": PERMISSIONS.VIEW_DISTRICT_RISK,
  "/alerts": PERMISSIONS.VIEW_ALERTS,
  "/pattern-discovery": PERMISSIONS.VIEW_PATTERN_DISCOVERY,
  "/hotspot-map": PERMISSIONS.VIEW_HOTSPOT_MAP,
  "/crime-time-machine": PERMISSIONS.VIEW_TIME_MACHINE,
  "/crime-forecast": PERMISSIONS.VIEW_FORECAST,
  "/socio-economic-insights": PERMISSIONS.VIEW_SOCIO_ECONOMIC,
  "/district-analytics": PERMISSIONS.VIEW_DISTRICT_ANALYTICS,
  "/risk-intelligence": PERMISSIONS.VIEW_RISK_INTELLIGENCE,
  "/ai-insights": PERMISSIONS.VIEW_AI_INSIGHTS,
  "/ai-report": PERMISSIONS.GENERATE_REPORTS,
  "/reports": PERMISSIONS.EXPORT_REPORTS,
  "/presentation-mode": PERMISSIONS.VIEW_PRESENTATION_MODE,
  "/diagnostics": PERMISSIONS.VIEW_DIAGNOSTICS,
  "/settings/users": PERMISSIONS.MANAGE_USERS
};

export const routeModules: Record<string, string> = {
  "/dashboard": "dashboard",
  "/upload": "upload",
  "/records": "records",
  "/district-risk-dna": "district-risk-dna",
  "/alerts": "alerts",
  "/pattern-discovery": "pattern-discovery",
  "/hotspot-map": "hotspot-map",
  "/crime-time-machine": "crime-time-machine",
  "/crime-forecast": "crime-forecast",
  "/socio-economic-insights": "socio-economic-insights",
  "/district-analytics": "district-analytics",
  "/risk-intelligence": "risk-intelligence",
  "/ai-insights": "ai-insights",
  "/ai-report": "ai-report",
  "/reports": "reports",
  "/presentation-mode": "presentation-mode",
  "/diagnostics": "diagnostics",
  "/settings/users": "settings/users"
};
