import type {
  ApiResponse,
  ChartDatum,
  CrimeRecord,
  DashboardFilterOptions,
  DashboardFilters,
  DashboardSummary,
  DistrictAnalyticsProfile,
  DistrictAnalyticsRanking,
  DistrictAnalyticsSummary,
  DistrictCrimeTypeItem,
  DistrictPoliceStationItem,
  DistrictTrendItem,
  GlobalStats,
  MonthlyTrend,
  YearlyTrend
} from "../types/crime";
import { crimeService } from "./crimeService";
import { toDashboardFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL, invalidateCrimePulseCache } from "../utils/apiCache";

const dashboardApiBase = import.meta.env.VITE_DASHBOARD_API_BASE || "/server/dashboard-api";

const shouldSendFilter = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const dashboardFilterAliases: Record<string, string> = {
  year: "fir_year",
  firYear: "fir_year",
  fir_year: "fir_year",
  month: "fir_month",
  firMonth: "fir_month",
  fir_month: "fir_month",
  district: "district",
  policeStation: "police_station",
  police_station: "police_station",
  crimeGroup: "crime_type",
  crime_group: "crime_type",
  crimeType: "crime_type",
  crime_type: "crime_type",
  firType: "severity",
  fir_type: "severity",
  severity: "severity",
  firStage: "fir_stage",
  status: "fir_stage",
  fir_stage: "fir_stage",
  complaintMode: "complaint_mode",
  complaint_mode: "complaint_mode",
  crime_subtype: "crime_subtype",
  dataset_id: "dataset_id"
};

export const buildDashboardQueryParams = (filters: DashboardFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([rawKey, value]) => {
    if (!shouldSendFilter(value)) return;
    const key = dashboardFilterAliases[rawKey] || rawKey;
    params.set(key, String(value));
  });
  return params;
};

const queryString = (filters: DashboardFilters = {}) => {
  const query = buildDashboardQueryParams(filters).toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: DashboardFilters, options?: RequestInit): Promise<T> => {
  const endpoint = `${dashboardApiBase}${path}${queryString(filters)}`;
  const cacheKey = buildCacheKey(`dashboard:${path}`, buildDashboardQueryParams(filters).toString());
  if (import.meta.env.DEV) {
    console.log("[Dashboard Filters] Query params:", buildDashboardQueryParams(filters).toString());
    console.log("[Dashboard Filters] Cache key:", cacheKey);
    console.log("[Dashboard Filters] API URL:", endpoint);
  }
  const method = String(options?.method || "GET").toUpperCase();
  const json = await cachedApiFetch<T>(cacheKey, endpoint, {
    ...options,
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.analytics,
    forceRefresh: method !== "GET",
    parseResponse: async (response) => {
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Endpoint failed: ${path}. Dashboard API did not return JSON. Start Catalyst Functions and verify dashboard-api is mounted.`);
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { message?: string; error?: string; details?: string; path?: string }));
        const backendMessage = [body.message, body.error, body.details].filter(Boolean).join(" | ");
        throw new Error(`Endpoint failed: ${body.path || path}. ${backendMessage || `Dashboard request failed with status ${response.status}`}`);
      }
      return response.json() as Promise<T>;
    }
  });
  if (import.meta.env.DEV && (json as { meta?: unknown })?.meta) console.log("[Dashboard Filters] Response meta:", (json as { meta?: unknown }).meta);
  if (method !== "GET") invalidateCrimePulseCache();
  return json;
};

export const dashboardService = {
  getGlobalStats: () => request<ApiResponse<GlobalStats>>("/dashboard/global-stats"),
  rebuildAnalytics: () => request<ApiResponse<{ recordsAnalyzed: number; generatedAt: string; cacheVersion: string; durationMs?: number }>>("/analytics/rebuild", undefined, { method: "POST" }),
  getSummary: (filters?: DashboardFilters) =>
    request<ApiResponse<DashboardSummary>>("/dashboard/summary", filters),
  getMonthlyTrends: (filters?: DashboardFilters) =>
    request<ApiResponse<MonthlyTrend[]>>("/dashboard/monthly-trends", filters),
  getYearlyTrends: (filters?: DashboardFilters) =>
    request<ApiResponse<YearlyTrend[]>>("/dashboard/yearly-trends", filters),
  getCrimeTypes: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/crime-types", filters),
  getDistrictRanking: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/district-ranking", filters),
  getPoliceStationRanking: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/police-station-ranking", filters),
  getCrimeGroupRanking: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/crime-group-ranking", filters),
  getCrimeHeadRanking: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/crime-head-ranking", filters),
  getFirStageSummary: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/fir-stage-summary", filters),
  getComplaintModeSummary: (filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>("/dashboard/complaint-mode-summary", filters),
  getRecentRecords: (filters?: DashboardFilters) =>
    request<ApiResponse<CrimeRecord[]>>("/dashboard/recent-records", filters),
  getFilters: async () => ({ success: true, data: toDashboardFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<DashboardFilterOptions>),
  getDistrictAnalyticsSummary: (filters?: DashboardFilters) =>
    request<ApiResponse<DistrictAnalyticsSummary>>("/dashboard/district-analytics/summary", filters),
  getDistrictAnalyticsRanking: (filters?: DashboardFilters) =>
    request<ApiResponse<DistrictAnalyticsRanking[]>>("/dashboard/district-analytics/ranking", filters),
  getDistrictAnalyticsProfile: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<DistrictAnalyticsProfile>>(`/dashboard/district-analytics/${encodeURIComponent(district)}`, filters),
  getDistrictAnalyticsTrends: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<DistrictTrendItem[]>>(`/dashboard/district-analytics/${encodeURIComponent(district)}/trends`, filters),
  getDistrictAnalyticsCrimeTypes: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<DistrictCrimeTypeItem[]>>(`/dashboard/district-analytics/${encodeURIComponent(district)}/crime-types`, filters),
  getDistrictAnalyticsPoliceStations: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<DistrictPoliceStationItem[]>>(`/dashboard/district-analytics/${encodeURIComponent(district)}/police-stations`, filters),
  getDistrictAnalyticsFirStages: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>(`/dashboard/district-analytics/${encodeURIComponent(district)}/fir-stages`, filters),
  getDistrictAnalyticsComplaintModes: (district: string, filters?: DashboardFilters) =>
    request<ApiResponse<ChartDatum[]>>(`/dashboard/district-analytics/${encodeURIComponent(district)}/complaint-modes`, filters),
  getDistrictAnalyticsFilters: async () => ({ success: true, data: toDashboardFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<DashboardFilterOptions>)
};
