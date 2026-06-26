import type {
  MovementPattern,
  TimeMachineChangeItem,
  TimeMachineCompare,
  TimeMachineFilterOptions,
  TimeMachineFilters,
  TimeMachineInsight,
  TimeMachineMonthlyItem,
  TimeMachinePeriodDetails,
  TimeMachineSummary,
  TimeMachineTimelineItem,
  TimeMachineYearlyItem
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";
import { crimeService } from "./crimeService";
import { toTimeMachineFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL } from "../utils/apiCache";

const timeMachineApiBase = import.meta.env.VITE_TIME_MACHINE_API_BASE || "/server/time-machine-api";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string;
};

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: TimeMachineFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

export function extractApiData<T>(response: ApiEnvelope<T> | T | null | undefined): T | null {
  if (!response) return null;
  if (typeof response === "object" && !Array.isArray(response) && "data" in response) {
    return (response as ApiEnvelope<T>).data ?? null;
  }
  return response as T;
}

const request = async <T>(path: string, filters?: TimeMachineFilters): Promise<T> => {
  const endpoint = `${timeMachineApiBase}${path}${queryString(filters)}`;
  return cachedApiFetch<T>(buildCacheKey(`time-machine:${path}`, filters), endpoint, {
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.analytics,
    parseResponse: async (response) => {
      const parsed = await readJsonOrLocalFallback<ApiEnvelope<T> | T>(response, path);

      if (!response.ok || (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && "success" in parsed && parsed.success === false)) {
        const failure = parsed as ApiEnvelope<T>;
        throw new Error([failure.message, failure.error, failure.details].filter(Boolean).join(" | ") || `Time Machine request failed with status ${response.status}`);
      }

      const data = extractApiData<T>(parsed);
      if (data === null) throw new Error(`Time Machine endpoint returned no data: ${path}`);
      return data;
    }
  });
};

export const timeMachineService = {
  getSummary: (filters?: TimeMachineFilters) => request<TimeMachineSummary>("/time-machine/summary", filters),
  getTimeline: (filters?: TimeMachineFilters) => request<TimeMachineTimelineItem[]>("/time-machine/timeline", filters),
  getYearly: (filters?: TimeMachineFilters) => request<TimeMachineYearlyItem[]>("/time-machine/yearly", filters),
  getMonthly: (filters?: TimeMachineFilters) => request<TimeMachineMonthlyItem[]>("/time-machine/monthly", filters),
  getCompare: (filters?: TimeMachineFilters) => request<TimeMachineCompare>("/time-machine/compare", filters),
  getMovement: (filters?: TimeMachineFilters) => request<{ movement_patterns: MovementPattern[]; rising_districts: TimeMachineChangeItem[]; falling_districts: TimeMachineChangeItem[]; rising_crime_types: TimeMachineChangeItem[]; falling_crime_types: TimeMachineChangeItem[]; rising_police_stations: TimeMachineChangeItem[]; falling_police_stations: TimeMachineChangeItem[] }>("/time-machine/movement", filters),
  getInsights: (filters?: TimeMachineFilters) => request<TimeMachineInsight[]>("/time-machine/insights", filters),
  getPeriod: (period: string, filters?: TimeMachineFilters) => request<TimeMachinePeriodDetails>("/time-machine/period", { ...filters, period }),
  getFilters: async () => toTimeMachineFilterOptions((await crimeService.getCrimeRecordFilters()).data)
};
