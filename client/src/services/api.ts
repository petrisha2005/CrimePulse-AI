import type { ApiResponse, ChartDatum, CrimeRecord, DashboardSummary, MonthlyTrend, UploadSummary } from "../types/crime";
import { buildCacheKey, cachedApiFetch, CACHE_TTL, invalidateCrimePulseCache } from "../utils/apiCache";

const crimeApiBase = import.meta.env.VITE_CRIME_API_BASE || "/server/crime-api";
const dashboardApiBase = import.meta.env.VITE_DASHBOARD_API_BASE || "/server/dashboard-api";

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const method = String(options?.method || "GET").toUpperCase();
  return cachedApiFetch<T>(buildCacheKey(`legacy:${url}`, method === "GET" ? {} : { body: options?.body ? String(options.body) : "" }), url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options,
    ttlMs: url.includes("/crimes") ? CACHE_TTL.records : CACHE_TTL.analytics,
    forceRefresh: method !== "GET",
    parseResponse: async (response) => {
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Request failed with status ${response.status}`);
      }

      return response.json() as Promise<T>;
    }
  });
};

export const crimeApi = {
  getCrimes: () => request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes`),
  createCrime: (crime: CrimeRecord) =>
    request<ApiResponse<CrimeRecord>>(`${crimeApiBase}/crimes`, {
      method: "POST",
      body: JSON.stringify(crime)
    }),
  uploadCsv: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${crimeApiBase}/crimes/upload-csv`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "CSV upload failed");
    }

    const result = await response.json() as ApiResponse<UploadSummary>;
    invalidateCrimePulseCache();
    return result;
  }
};

export const dashboardApi = {
  getSummary: () => request<ApiResponse<DashboardSummary>>(`${dashboardApiBase}/dashboard/summary`),
  getMonthlyTrends: () => request<ApiResponse<MonthlyTrend[]>>(`${dashboardApiBase}/dashboard/monthly-trends`),
  getCrimeTypes: () => request<ApiResponse<ChartDatum[]>>(`${dashboardApiBase}/dashboard/crime-types`),
  getDistrictRanking: () => request<ApiResponse<ChartDatum[]>>(`${dashboardApiBase}/dashboard/district-ranking`),
  getFirStageSummary: () => request<ApiResponse<ChartDatum[]>>(`${dashboardApiBase}/dashboard/fir-stage-summary`)
};
