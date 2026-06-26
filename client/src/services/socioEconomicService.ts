import type {
  ApiResponse,
  SocioEconomicComparisonRow,
  SocioEconomicCorrelationPoint,
  SocioEconomicFilterOptions,
  SocioEconomicFilters,
  SocioEconomicInsight,
  SocioEconomicOverview,
  SocioEconomicProfile,
  SocioEconomicRecommendation,
  SocioEconomicRiskIndicators,
  SocioEconomicVulnerabilityItem
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";
import { crimeService } from "./crimeService";
import { toSocioEconomicFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL } from "../utils/apiCache";

const socioApiBase = import.meta.env.VITE_SOCIO_ECONOMIC_API_BASE || "/server/socio-economic-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string };

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: SocioEconomicFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: SocioEconomicFilters, options?: RequestInit): Promise<T> => {
  const endpoint = `${socioApiBase}${path}${queryString(filters)}`;
  const method = String(options?.method || "GET").toUpperCase();
  return cachedApiFetch<T>(buildCacheKey(`socio:${path}`, filters), endpoint, {
    ...options,
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.analytics,
    forceRefresh: method !== "GET",
    parseResponse: async (response) => {
      if (!response.ok) {
        const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
        const parts = [body.message, body.error, body.details].filter(Boolean);
        throw new Error(parts.join(" | ") || `Socio-economic request failed with status ${response.status}`);
      }
      return readJsonOrLocalFallback<T>(response, path);
    }
  });
};

export const socioEconomicService = {
  getSummary: (filters?: SocioEconomicFilters) => request<ApiResponse<SocioEconomicOverview>>("/socio-economic/summary", filters),
  getProfiles: (filters?: SocioEconomicFilters) => request<ApiResponse<SocioEconomicProfile[]>>("/socio-economic/profiles", filters),
  getDistrictProfiles: (filters?: SocioEconomicFilters) => request<ApiResponse<SocioEconomicComparisonRow[]>>("/socio-economic/district-profile", filters),
  getRiskIndicators: (filters?: SocioEconomicFilters) => request<ApiResponse<SocioEconomicRiskIndicators>>("/socio-economic/risk-indicators", filters),
  getInsights: (filters?: SocioEconomicFilters) =>
    request<ApiResponse<{ overview: SocioEconomicOverview; insights: SocioEconomicInsight[] }>>("/socio-economic/insights", filters),
  getCorrelation: (filters?: SocioEconomicFilters) =>
    request<ApiResponse<SocioEconomicCorrelationPoint[]>>("/socio-economic/correlation", filters),
  getVulnerabilityIndex: (filters?: SocioEconomicFilters) =>
    request<ApiResponse<SocioEconomicVulnerabilityItem[]>>("/socio-economic/vulnerability-index", filters),
  getRecommendations: (filters?: SocioEconomicFilters) =>
    request<ApiResponse<SocioEconomicRecommendation[]>>("/socio-economic/recommendations", filters),
  getComparison: (filters?: SocioEconomicFilters) =>
    request<ApiResponse<SocioEconomicComparisonRow[]>>("/socio-economic/comparison", filters),
  getDistrict: (district: string, filters?: SocioEconomicFilters) =>
    request<ApiResponse<SocioEconomicComparisonRow | null>>(`/socio-economic/district/${encodeURIComponent(district)}`, filters),
  getFilters: async () => ({ success: true, data: toSocioEconomicFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<SocioEconomicFilterOptions>),
  uploadCsv: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<ApiResponse<{ insertedRows: number; validationErrors: string[] }>>("/socio-economic/upload-csv", undefined, {
      method: "POST",
      body: formData
    });
  }
};
