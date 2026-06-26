import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCacheKey, cacheAgeLabel, cachedApiFetch, CACHE_TTL, getCached } from "../utils/apiCache";

type UseCachedFeatureDataOptions<T> = {
  cacheKey: string;
  url: string;
  filters?: Record<string, unknown>;
  roleScope?: Record<string, unknown>;
  ttlMs?: number;
  enabled?: boolean;
  parseResponse?: (response: Response) => Promise<T>;
};

export const useCachedFeatureData = <T,>({
  cacheKey,
  url,
  filters = {},
  roleScope = {},
  ttlMs = CACHE_TTL.analytics,
  enabled = true,
  parseResponse
}: UseCachedFeatureDataOptions<T>) => {
  const key = useMemo(() => buildCacheKey(cacheKey, filters, roleScope), [cacheKey, filters, roleScope]);
  const cached = useMemo(() => getCached<T>(key), [key]);
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(enabled && cached === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cached ? cacheAgeLabel(key) : "");

  const refresh = useCallback(async (forceRefresh = false) => {
    if (!enabled) return null;
    try {
      setError("");
      if (data === null) setLoading(true);
      else setRefreshing(true);
      const result = await cachedApiFetch<T>(key, url, { ttlMs, forceRefresh, parseResponse });
      setData(result);
      setLastUpdatedAt(cacheAgeLabel(key) || "updated just now");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load feature data.");
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data, enabled, key, parseResponse, ttlMs, url]);

  useEffect(() => {
    const nextCached = getCached<T>(key);
    if (nextCached !== null) {
      setData(nextCached);
      setLoading(false);
      setLastUpdatedAt(cacheAgeLabel(key));
      return;
    }
    void refresh(false);
  }, [key, refresh]);

  return { data, loading, refreshing, error, lastUpdatedAt, refresh };
};
