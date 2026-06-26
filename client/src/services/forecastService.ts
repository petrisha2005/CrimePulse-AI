import type { ApiResponse, CrimeForecast, CrimeTypeForecast, ForecastFilterOptions, ForecastFilters, ForecastRecommendation, ForecastRiskCalendarItem, ForecastSummary } from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";
import { crimeService } from "./crimeService";
import { toForecastFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL } from "../utils/apiCache";

const forecastApiBase = import.meta.env.VITE_FORECAST_API_BASE || "/server/forecast-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string };

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: ForecastFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: ForecastFilters): Promise<T> => {
  const endpoint = `${forecastApiBase}${path}${queryString(filters)}`;
  return cachedApiFetch<T>(buildCacheKey(`forecast:${path}`, filters), endpoint, {
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.analytics,
    parseResponse: async (response) => {
      if (!response.ok) {
        const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
        const parts = [body.message, body.error, body.details].filter(Boolean);
        throw new Error(parts.join(" | ") || `Forecast request failed with status ${response.status}`);
      }
      return readJsonOrLocalFallback<T>(response, path);
    }
  });
};

export const forecastService = {
  getToday: (filters?: ForecastFilters) => request<ApiResponse<CrimeForecast | null>>("/forecast/today", filters),
  getTomorrow: (filters?: ForecastFilters) => request<ApiResponse<CrimeForecast | null>>("/forecast/tomorrow", filters),
  getNextSevenDays: (filters?: ForecastFilters) => request<ApiResponse<CrimeForecast[]>>("/forecast/next-7-days", filters),
  getDistricts: (filters?: ForecastFilters) => request<ApiResponse<CrimeForecast[]>>("/forecast/districts", filters),
  getDistrict: (district: string, filters?: ForecastFilters) =>
    request<ApiResponse<CrimeForecast | null>>(`/forecast/district/${encodeURIComponent(district)}`, filters),
  getCrimeTypes: (filters?: ForecastFilters) => request<ApiResponse<CrimeTypeForecast[]>>("/forecast/crime-types", filters),
  getRiskCalendar: (filters?: ForecastFilters) => request<ApiResponse<ForecastRiskCalendarItem[]>>("/forecast/risk-calendar", filters),
  getRecommendations: (filters?: ForecastFilters) => request<ApiResponse<ForecastRecommendation[]>>("/forecast/recommendations", filters),
  getSummary: (filters?: ForecastFilters) => request<ApiResponse<ForecastSummary | null>>("/forecast/summary", filters),
  getFilters: async () => ({ success: true, data: toForecastFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<ForecastFilterOptions>)
};
