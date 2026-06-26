import type { ApiResponse, CrimePattern, PatternCharts, PatternFilterOptions, PatternFilters, PatternSummary } from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";
import { crimeService } from "./crimeService";
import { toPatternFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL } from "../utils/apiCache";

const patternApiBase = import.meta.env.VITE_PATTERN_API_BASE || "/server/pattern-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string };

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: PatternFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: PatternFilters): Promise<T> => {
  const endpoint = `${patternApiBase}${path}${queryString(filters)}`;
  return cachedApiFetch<T>(buildCacheKey(`patterns:${path}`, filters), endpoint, {
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.analytics,
    parseResponse: async (response) => {
      if (!response.ok) {
        const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
        const parts = [body.message, body.error, body.details].filter(Boolean);
        throw new Error(parts.join(" | ") || `Pattern request failed with status ${response.status}`);
      }
      return readJsonOrLocalFallback<T>(response, path);
    }
  });
};

export const patternService = {
  discover: (filters?: PatternFilters) => request<ApiResponse<CrimePattern[]>>("/patterns/discover", filters),
  getSummary: (filters?: PatternFilters) => request<ApiResponse<PatternSummary>>("/patterns/summary", filters),
  getByType: (filters?: PatternFilters) => request<ApiResponse<Record<string, CrimePattern[]>>>("/patterns/by-type", filters),
  getWhispers: (filters?: PatternFilters) => request<ApiResponse<string[]>>("/patterns/whispers", filters),
  getCharts: (filters?: PatternFilters) => request<ApiResponse<PatternCharts>>("/patterns/charts", filters),
  getFilters: async () => ({ success: true, data: toPatternFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<PatternFilterOptions>),
  getDetail: (patternId: string, filters?: PatternFilters) =>
    request<ApiResponse<CrimePattern | null>>(`/patterns/detail/${encodeURIComponent(patternId)}`, filters)
};
