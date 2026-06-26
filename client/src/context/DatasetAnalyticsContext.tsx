import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { crimeService } from "../services/crimeService";
import { dashboardService } from "../services/dashboardService";
import { toDashboardFilterOptions } from "../utils/dynamicFilterOptions";
import type { CrimeRecordFilterOptions, DashboardFilterOptions, GlobalStats } from "../types/crime";

type DatasetAnalyticsContextValue = {
  totalRecords: number;
  globalStats: GlobalStats | null;
  filterOptions: DashboardFilterOptions | null;
  rawFilterOptions: CrimeRecordFilterOptions | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastFetchedAt: string;
  refreshAnalytics: (options?: { rebuild?: boolean }) => Promise<void>;
  clearSessionCache: () => void;
};

const DatasetAnalyticsContext = createContext<DatasetAnalyticsContextValue | null>(null);

const getCount = (response: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  response.totalRecords ?? response.data?.totalRecords ?? 0;

const SESSION_KEY = "crimepulse_dataset_analytics_cache";

const readSessionCache = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Pick<DatasetAnalyticsContextValue, "totalRecords" | "globalStats" | "filterOptions" | "rawFilterOptions" | "lastFetchedAt"> : null;
  } catch {
    return null;
  }
};

export const DatasetAnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const cached = readSessionCache();
  const [totalRecords, setTotalRecords] = useState(cached?.totalRecords ?? 0);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(cached?.globalStats ?? null);
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(cached?.filterOptions ?? null);
  const [rawFilterOptions, setRawFilterOptions] = useState<CrimeRecordFilterOptions | null>(cached?.rawFilterOptions ?? null);
  const [lastFetchedAt, setLastFetchedAt] = useState(cached?.lastFetchedAt ?? "");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const persist = useCallback((next: Pick<DatasetAnalyticsContextValue, "totalRecords" | "globalStats" | "filterOptions" | "rawFilterOptions" | "lastFetchedAt">) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      // Session caching is only an optimization.
    }
  }, []);

  const clearSessionCache = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setGlobalStats(null);
    setFilterOptions(null);
    setRawFilterOptions(null);
    setLastFetchedAt("");
  }, []);

  const refreshAnalytics = useCallback(async (options?: { rebuild?: boolean }) => {
    try {
      setError("");
      setRefreshing(true);
      if (options?.rebuild) {
        clearSessionCache();
        await dashboardService.rebuildAnalytics();
      }
      const countResponse = await crimeService.getCrimeCount();
      const count = getCount(countResponse);
      setTotalRecords(count);
      if (count === 0) {
        const fetchedAt = new Date().toISOString();
        const empty = { totalRecords: 0, globalStats: null, filterOptions: null, rawFilterOptions: null, lastFetchedAt: fetchedAt };
        persist(empty);
        setLastFetchedAt(fetchedAt);
        return;
      }
      const [statsResponse, filtersResponse] = await Promise.all([
        dashboardService.getGlobalStats(),
        crimeService.getCrimeRecordFilters()
      ]);
      const stats = {
        ...statsResponse.data,
        total_records: count,
        total_uploaded_records: statsResponse.data.total_uploaded_records ?? count,
        is_cached: statsResponse.meta?.isCached,
        cache_generated_at: statsResponse.meta?.cacheGeneratedAt,
        duration_ms: statsResponse.meta?.durationMs
      };
      const rawFilters = filtersResponse.data;
      const dashboardFilters = toDashboardFilterOptions(rawFilters);
      const fetchedAt = new Date().toISOString();
      setGlobalStats(stats);
      setRawFilterOptions(rawFilters);
      setFilterOptions(dashboardFilters);
      setLastFetchedAt(fetchedAt);
      persist({ totalRecords: count, globalStats: stats, filterOptions: dashboardFilters, rawFilterOptions: rawFilters, lastFetchedAt: fetchedAt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load analytics summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clearSessionCache, persist]);

  useEffect(() => {
    void refreshAnalytics();
    const onDatasetUpdated = () => void refreshAnalytics();
    const onCacheInvalidated = () => {
      clearSessionCache();
      void refreshAnalytics();
    };
    window.addEventListener("crimepulse:dataset-updated", onDatasetUpdated);
    window.addEventListener("crimepulse:api-cache-invalidated", onCacheInvalidated);
    return () => {
      window.removeEventListener("crimepulse:dataset-updated", onDatasetUpdated);
      window.removeEventListener("crimepulse:api-cache-invalidated", onCacheInvalidated);
    };
  }, [clearSessionCache, refreshAnalytics]);

  const value = useMemo(() => ({
    totalRecords,
    globalStats,
    filterOptions,
    rawFilterOptions,
    loading,
    refreshing,
    error,
    lastFetchedAt,
    refreshAnalytics,
    clearSessionCache
  }), [clearSessionCache, error, filterOptions, globalStats, lastFetchedAt, loading, rawFilterOptions, refreshAnalytics, refreshing, totalRecords]);

  return <DatasetAnalyticsContext.Provider value={value}>{children}</DatasetAnalyticsContext.Provider>;
};

export const useDatasetAnalytics = () => {
  const context = useContext(DatasetAnalyticsContext);
  if (!context) throw new Error("useDatasetAnalytics must be used within DatasetAnalyticsProvider");
  return context;
};
