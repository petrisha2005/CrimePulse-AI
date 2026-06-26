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
import { crimeService } from "./crimeService";
import { toAiInsightFilterOptions } from "../utils/dynamicFilterOptions";
import { buildCacheKey, cachedApiFetch, CACHE_TTL } from "../utils/apiCache";

const aiApiBase = import.meta.env.VITE_AI_API_BASE || "/server/ai-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string };

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
  const method = String(options?.method || "GET").toUpperCase();
  return cachedApiFetch<T>(buildCacheKey(`ai:${path}`, method === "GET" ? {} : { body: options?.body ? String(options.body) : "" }), `${aiApiBase}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
    ttlMs: path.includes("filters") ? CACHE_TTL.filters : CACHE_TTL.ai,
    forceRefresh: method !== "GET",
    parseResponse: async (response) => {
      if (!response.ok) {
        const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
        const message = [body.message, body.error, body.details].filter(Boolean).join(" | ");
        throw new Error(message || `AI request failed with status ${response.status}`);
      }

      return readJsonOrLocalFallback<T>(response, path);
    }
  });
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

  getFilters: async () => ({ success: true, data: toAiInsightFilterOptions((await crimeService.getCrimeRecordFilters()).data) } as ApiResponse<AiInsightFilterOptions>)
};
