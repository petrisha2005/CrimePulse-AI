import type {
  ApiResponse,
  DashboardFilterOptions,
  DashboardFilters,
  DistrictRiskDna,
  DistrictRiskListItem,
  RiskCrimeTypeRanking,
  RiskDistrictRanking,
  RiskFactor,
  RiskIntelligenceSummary,
  RiskInterventionPlan,
  RiskPoliceStationRanking,
  RiskPriorityZone
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const riskApiBase = import.meta.env.VITE_RISK_API_BASE || "/server/risk-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string; path?: string };

type RiskFilters = Pick<DashboardFilters, "year" | "month" | "fir_year" | "fir_month" | "crime_type" | "severity" | "fir_stage" | "status">;

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: RiskFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: RiskFilters): Promise<T> => {
  const response = await fetch(`${riskApiBase}${path}${queryString(filters)}`);
  if (!response.ok) {
    const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
    const detail = [body.message, body.error, body.details].filter(Boolean).join(" | ");
    throw new Error(`Endpoint failed: ${body.path || path}. ${detail || `Risk request failed with status ${response.status}`}`);
  }
  return readJsonOrLocalFallback<T>(response, path);
};

export const riskService = {
  getDistricts: (filters?: RiskFilters) => request<ApiResponse<DistrictRiskListItem[]>>("/risk/districts", filters),
  getDistrictDna: (district: string, filters?: RiskFilters) =>
    request<ApiResponse<DistrictRiskDna | null>>(`/risk/dna/${encodeURIComponent(district)}`, filters),
  getDistrictScore: (district: string, filters?: RiskFilters) =>
    request<ApiResponse<Pick<DistrictRiskDna, "district" | "risk_score" | "risk_level" | "confidence_score">>>(
      `/risk/score/${encodeURIComponent(district)}`,
      filters
    ),
  getWhy: (district: string, filters?: RiskFilters) =>
    request<ApiResponse<string[]>>(`/risk/why/${encodeURIComponent(district)}`, filters),
  getRecommendations: (district: string, filters?: RiskFilters) =>
    request<ApiResponse<string[]>>(`/risk/recommendations/${encodeURIComponent(district)}`, filters),
  getFilters: () => request<ApiResponse<DashboardFilterOptions>>("/risk/filters"),
  getSummary: (filters?: RiskFilters) => request<ApiResponse<unknown>>("/risk/summary", filters),
  getRiskIntelligenceSummary: (filters?: RiskFilters) => request<ApiResponse<RiskIntelligenceSummary>>("/risk-intelligence/summary", filters),
  getRiskDistricts: (filters?: RiskFilters) => request<ApiResponse<RiskDistrictRanking[]>>("/risk-intelligence/district-risk", filters),
  getRiskPoliceStations: (filters?: RiskFilters) => request<ApiResponse<RiskPoliceStationRanking[]>>("/risk-intelligence/police-station-risk", filters),
  getRiskCrimeTypes: (filters?: RiskFilters) => request<ApiResponse<RiskCrimeTypeRanking[]>>("/risk-intelligence/crime-type-risk", filters),
  getPriorityZones: (filters?: RiskFilters) => request<ApiResponse<RiskPriorityZone[]>>("/risk-intelligence/priority-zones", filters),
  getRiskFactors: (filters?: RiskFilters) => request<ApiResponse<RiskFactor[]>>("/risk-intelligence/risk-factors", filters),
  getInterventionPlan: (filters?: RiskFilters) => request<ApiResponse<RiskInterventionPlan[]>>("/risk-intelligence/intervention-plan", filters),
  getRiskIntelligenceFilters: () => request<ApiResponse<DashboardFilterOptions>>("/risk-intelligence/filters")
};
