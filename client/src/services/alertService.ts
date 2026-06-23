import type { AlertCharts, AlertFilterOptions, AlertFilters, AlertSummary, ApiResponse, RedZoneAlert } from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const alertApiBase = import.meta.env.VITE_ALERT_API_BASE || "/server/alert-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string; path?: string };

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: AlertFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: AlertFilters): Promise<T> => {
  const response = await fetch(`${alertApiBase}${path}${queryString(filters)}`);
  if (!response.ok) {
    const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
    const parts = [body.message, body.error, body.details].filter(Boolean);
    throw new Error(parts.join(" | ") || `Alert request failed with status ${response.status}`);
  }
  return readJsonOrLocalFallback<T>(response, path);
};

export const alertService = {
  getAlerts: (filters?: AlertFilters) => request<ApiResponse<RedZoneAlert[]>>("/alerts", filters),
  getSummary: (filters?: AlertFilters) => request<ApiResponse<AlertSummary>>("/alerts/summary", filters),
  getAnomalies: (filters?: AlertFilters) => request<ApiResponse<RedZoneAlert[]>>("/alerts/anomalies", filters),
  getPatternWhispers: (filters?: AlertFilters) => request<ApiResponse<string[]>>("/alerts/pattern-whispers", filters),
  getCharts: (filters?: AlertFilters) => request<ApiResponse<AlertCharts>>("/alerts/charts", filters),
  getFilters: () => request<ApiResponse<AlertFilterOptions>>("/alerts/filters")
};
