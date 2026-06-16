import type {
  AiAskResponse,
  AiGeneratedInsight,
  AiInsightFilterOptions,
  AiInsightFilters,
  AiRecommendation,
  AiSummary,
  ApiResponse
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const aiApiBase = import.meta.env.VITE_AI_API_BASE || "/server/ai-api";

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: AiInsightFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${aiApiBase}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await readJsonOrLocalFallback<{ message?: string; error?: string; details?: string }>(response, path).catch(() => ({}));
    const message = [body.message, body.error, body.details].filter(Boolean).join(" | ");
    throw new Error(message || `AI request failed with status ${response.status}`);
  }

  return readJsonOrLocalFallback<T>(response, path);
};

export const aiService = {
  getSummary: (filters?: AiInsightFilters) =>
    request<ApiResponse<AiSummary>>(`/ai/summary${queryString(filters)}`),

  getInsights: (filters?: AiInsightFilters) =>
    request<ApiResponse<AiGeneratedInsight[]>>(`/ai/insights${queryString(filters)}`),

  explainRisk: (filters?: AiInsightFilters) =>
    request<ApiResponse<{ explanation: string; factors: string[]; risk_score: number; risk_level: string }>>(`/ai/explain-risk${queryString(filters)}`),

  getRecommendations: (filters?: AiInsightFilters) =>
    request<ApiResponse<AiRecommendation[]>>(`/ai/recommendations${queryString(filters)}`),

  ask: (question: string, filters?: AiInsightFilters) =>
    request<ApiResponse<AiAskResponse>>("/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question, filters })
    }),

  getFilters: () => request<ApiResponse<AiInsightFilterOptions>>("/ai/filters")
};
