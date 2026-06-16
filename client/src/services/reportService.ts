import type { ApiResponse, GeneratedReportResponse, RecentReport, ReportRequest } from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const reportApiBase = import.meta.env.VITE_REPORT_API_BASE || "/server/report-api";

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${reportApiBase}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await readJsonOrLocalFallback<{ message?: string; error?: string; details?: string }>(response, path).catch(() => ({}));
    const message = [body.message, body.error, body.details].filter(Boolean).join(" | ");
    throw new Error(message || `Report request failed with status ${response.status}`);
  }

  return readJsonOrLocalFallback<T>(response, path);
};

export const reportService = {
  getSummary: () => request<ApiResponse<{ total_records: number; available_report_types: string[] }>>("/report/summary"),

  preview: (payload: ReportRequest) =>
    request<ApiResponse<GeneratedReportResponse | null>>("/report/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  generate: (payload: ReportRequest) =>
    request<ApiResponse<GeneratedReportResponse | null>>("/report/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getRecent: () => request<ApiResponse<RecentReport[]>>("/reports/recent"),

  downloadUrl: (reportId: string) => `${reportApiBase}/report/generate?report_id=${encodeURIComponent(reportId)}`
};
