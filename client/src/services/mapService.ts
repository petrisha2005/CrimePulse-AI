import type {
  ApiResponse,
  CrimeHotspot,
  CrimeMapPoint,
  DistrictIntensity,
  MapFilterOptions,
  MapFilters,
  MapSummary
} from "../types/crime";
import { readJsonOrLocalFallback } from "./localFallback";

const mapApiBase = import.meta.env.VITE_MAP_API_BASE || "/server/map-api";
type ApiErrorPayload = { message?: string; error?: string; details?: string };

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (filters: MapFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

const request = async <T>(path: string, filters?: MapFilters): Promise<T> => {
  const response = await fetch(`${mapApiBase}${path}${queryString(filters)}`);
  if (!response.ok) {
    const body: ApiErrorPayload = await readJsonOrLocalFallback<ApiErrorPayload>(response, path).catch(() => ({} as ApiErrorPayload));
    const parts = [body.message, body.error, body.details].filter(Boolean);
    throw new Error(parts.join(" | ") || `Map request failed with status ${response.status}`);
  }
  return readJsonOrLocalFallback<T>(response, path);
};

export const mapService = {
  getCrimePoints: (filters?: MapFilters) => request<ApiResponse<CrimeMapPoint[]>>("/map/crime-points", filters),
  getHotspots: (filters?: MapFilters) => request<ApiResponse<CrimeHotspot[]>>("/map/hotspots", filters),
  getDistrictIntensity: (filters?: MapFilters) => request<ApiResponse<DistrictIntensity[]>>("/map/district-intensity", filters),
  getPoliceStationIntensity: (filters?: MapFilters) => request<ApiResponse<CrimeHotspot[]>>("/map/police-station-intensity", filters),
  getHeatmap: (filters?: MapFilters) => request<ApiResponse<Array<{ latitude: number; longitude: number; weight: number; district: string; police_station: string; crime_type: string; coordinate_source: "original" | "district_fallback" | "karnataka_fallback" }>>>("/map/heatmap", filters),
  getSummary: (filters?: MapFilters) => request<ApiResponse<MapSummary>>("/map/summary", filters),
  getFilters: () => request<ApiResponse<MapFilterOptions>>("/map/filters")
};
