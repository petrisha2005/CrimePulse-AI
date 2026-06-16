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

const dashboardApiBase = import.meta.env.VITE_DASHBOARD_API_BASE || "/server/dashboard-api";

const shouldSendFilter = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: DashboardFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSendFilter(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: DashboardFilters): Promise<T> => {
  const endpoint = `${dashboardApiBase}${path}${queryString(filters)}`;
  const response = await fetch(endpoint);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Endpoint failed: ${path}. Dashboard API did not return JSON. Start Catalyst Functions and verify dashboard-api is mounted.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({} as { message?: string; error?: string; details?: string; path?: string }));
    const backendMessage = [body.message, body.error, body.details].filter(Boolean).join(" | ");
    throw new Error(`Endpoint failed: ${body.path || path}. ${backendMessage || `Dashboard request failed with status ${response.status}`}`);
  }
  return response.json();
};

export const dashboardService = {
  getGlobalStats: () => request<ApiResponse<GlobalStats>>("/dashboard/global-stats"),
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
  getFilters: () => request<ApiResponse<DashboardFilterOptions>>("/dashboard/filters"),
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
  getDistrictAnalyticsFilters: () => request<ApiResponse<DashboardFilterOptions>>("/dashboard/district-analytics/filters")
};
