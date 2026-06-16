import type {
  ApiResponse,
  MovementPattern,
  TimeMachineCompare,
  TimeMachineFilterOptions,
  TimeMachineFilters,
  TimeMachineInsight,
  TimeMachineMonthlyItem,
  TimeMachineSummary,
  TimeMachineTimelineItem,
  TimeMachineYearlyItem
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const timeMachineApiBase = import.meta.env.VITE_TIME_MACHINE_API_BASE || "/server/time-machine-api";

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

const request = async <T>(path: string, filters?: TimeMachineFilters): Promise<T> => {
  const response = await fetch(`${timeMachineApiBase}${path}${queryString(filters)}`);
  if (!response.ok) {
    const body = await readJsonOrLocalFallback<{ message?: string; error?: string; details?: string }>(response, path).catch(() => ({}));
    const parts = [body.message, body.error, body.details].filter(Boolean);
    throw new Error(parts.join(" | ") || `Time Machine request failed with status ${response.status}`);
  }
  return readJsonOrLocalFallback<T>(response, path);
};

export const timeMachineService = {
  getSummary: (filters?: TimeMachineFilters) =>
    request<ApiResponse<TimeMachineSummary>>("/time-machine/summary", filters),
  getTimeline: (filters?: TimeMachineFilters) =>
    request<ApiResponse<{ timeline: TimeMachineTimelineItem[] }>>("/time-machine/timeline", filters),
  getYearly: (filters?: TimeMachineFilters) =>
    request<ApiResponse<TimeMachineYearlyItem[]>>("/time-machine/yearly", filters),
  getMonthly: (filters?: TimeMachineFilters) =>
    request<ApiResponse<TimeMachineMonthlyItem[]>>("/time-machine/monthly", filters),
  getCompare: (filters?: TimeMachineFilters) =>
    request<ApiResponse<TimeMachineCompare>>("/time-machine/compare", filters),
  getMovement: (filters?: TimeMachineFilters) =>
    request<ApiResponse<{ movement_patterns: MovementPattern[] }>>("/time-machine/movement", filters),
  getInsights: (filters?: TimeMachineFilters) =>
    request<ApiResponse<{ insights: TimeMachineInsight[] }>>("/time-machine/insights", filters),
  getFilters: () => request<ApiResponse<TimeMachineFilterOptions>>("/time-machine/filters")
};
