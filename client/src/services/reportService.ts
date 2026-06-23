import type { DashboardFilterOptions, GeneratedReportResponse, ReportRequest } from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const reportApiBase = import.meta.env.VITE_REPORT_API_BASE || "/server/report-api";

type ApiEnvelope<T> = { success?: boolean; data?: T; message?: string; error?: string; details?: string };

const extractApiData = <T,>(response: ApiEnvelope<T> | T | null | undefined): T | null => {
  if (!response) return null;
  if (typeof response === "object" && !Array.isArray(response) && "data" in response) return (response as ApiEnvelope<T>).data ?? null;
  return response as T;
};

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${reportApiBase}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  const parsed = await readJsonOrLocalFallback<ApiEnvelope<T> | T>(response, path);
  if (!response.ok || (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && "success" in parsed && parsed.success === false)) {
    const failure = parsed as ApiEnvelope<T>;
    throw new Error([`Endpoint: ${path}`, `Status: ${response.status}`, failure.message, failure.error, failure.details].filter(Boolean).join(" | "));
  }
  const data = extractApiData<T>(parsed);
  if (data === null) throw new Error(`Endpoint: ${path} | Report API returned no data.`);
  return data;
};

export interface ReportSummary {
  total_records: number;
  records_analyzed: number;
  available_report_types: string[];
  ai_mode: "Gemini" | "Rule-based fallback" | string;
  generated_at: string;
  status: "ready" | string;
  coordinate_available_percentage?: number;
}

export const reportService = {
  getSummary: () => request<ReportSummary>("/report/summary"),
  getFilters: () => request<DashboardFilterOptions>("/report/filters"),
  preview: (payload: ReportRequest) => request<GeneratedReportResponse>("/report/preview", { method: "POST", body: JSON.stringify(payload) }),
  generate: (payload: ReportRequest) => request<GeneratedReportResponse>("/report/generate", { method: "POST", body: JSON.stringify(payload) })
};
