type CacheRecord<T> = {
  data: T;
  expiresAt: number;
  createdAt: number;
};

type CachedFetchOptions<T> = RequestInit & {
  ttlMs?: number;
  forceRefresh?: boolean;
  cachePost?: boolean;
  parseResponse?: (response: Response) => Promise<T>;
};

const CACHE_PREFIX = "crimepulse_api_cache:";
const DATASET_VERSION_KEY = "crimepulse_dataset_version";
const AUTH_STORAGE_KEY = "crimepulse_auth_user";
const DATASET_STORAGE_KEY = "crimepulse_active_dataset_id";

export const CACHE_TTL = {
  analytics: 5 * 60 * 1000,
  filters: 10 * 60 * 1000,
  reports: 5 * 60 * 1000,
  ai: 5 * 60 * 1000,
  records: 2 * 60 * 1000
} as const;

const memoryCache = new Map<string, CacheRecord<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

const safeJsonParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const stableObject = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(stableObject);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([, value]) => {
        const normalized = String(value ?? "").trim().toLowerCase();
        return normalized !== "" && normalized !== "all" && normalized !== "undefined" && normalized !== "null";
      })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, stableObject(value)])
  );
};

const userCacheScope = () => {
  const user = safeJsonParse<{ id?: string; role?: string; assignedDistrict?: string; assignedPoliceStation?: string; accessScope?: { type?: string; district?: string; police_station?: string } }>(localStorage.getItem(AUTH_STORAGE_KEY));
  return {
    userId: user?.id || "anonymous",
    role: user?.role || "none",
    district: user?.assignedDistrict || user?.accessScope?.district || "All",
    policeStation: user?.assignedPoliceStation || user?.accessScope?.police_station || "All"
  };
};

export const getDatasetVersion = () => localStorage.getItem(DATASET_VERSION_KEY) || "dataset_v1";

export const bumpDatasetVersion = () => {
  const next = `dataset_${Date.now()}`;
  localStorage.setItem(DATASET_VERSION_KEY, next);
  return next;
};

export const buildCacheKey = (routeName: string, filters?: unknown, roleScope?: unknown, datasetVersion = getDatasetVersion()) =>
  JSON.stringify({
    routeName,
    filters: stableObject(filters || {}),
    roleScope: stableObject(roleScope || userCacheScope()),
    datasetId: localStorage.getItem(DATASET_STORAGE_KEY) || "all",
    datasetVersion
  });

const sessionKey = (key: string) => `${CACHE_PREFIX}${key}`;

export const getCached = <T,>(key: string): T | null => {
  const now = Date.now();
  const memory = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (memory && memory.expiresAt > now) return memory.data;
  if (memory) memoryCache.delete(key);

  const stored = safeJsonParse<CacheRecord<T>>(sessionStorage.getItem(sessionKey(key)));
  if (!stored) return null;
  if (stored.expiresAt <= now) {
    sessionStorage.removeItem(sessionKey(key));
    return null;
  }
  memoryCache.set(key, stored);
  return stored.data;
};

export const setCached = <T,>(key: string, data: T, ttlMs = CACHE_TTL.analytics) => {
  const record: CacheRecord<T> = {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  memoryCache.set(key, record);
  try {
    sessionStorage.setItem(sessionKey(key), JSON.stringify(record));
  } catch {
    // Session storage is a fallback optimization only.
  }
  return data;
};

export const invalidateCache = (pattern?: string | RegExp) => {
  if (import.meta.env.DEV) console.log("[Cache INVALIDATE]", pattern || "all");
  const matches = (key: string) => !pattern || (typeof pattern === "string" ? key.includes(pattern) : pattern.test(key));
  [...memoryCache.keys()].forEach((key) => { if (matches(key)) memoryCache.delete(key); });
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    const rawKey = key.slice(CACHE_PREFIX.length);
    if (matches(rawKey)) sessionStorage.removeItem(key);
  }
};

export const invalidateCrimePulseCache = () => {
  bumpDatasetVersion();
  invalidateCache();
  sessionStorage.removeItem("crimepulse_dataset_analytics_cache");
  window.dispatchEvent(new Event("crimepulse:api-cache-invalidated"));
};

const defaultParse = async <T,>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("API did not return JSON.");
  return response.json() as Promise<T>;
};

export const cachedApiFetch = async <T,>(key: string, url: string, options: CachedFetchOptions<T> = {}): Promise<T> => {
  const method = String(options.method || "GET").toUpperCase();
  const ttlMs = options.ttlMs ?? CACHE_TTL.analytics;
  const cacheable = method === "GET" || Boolean(options.cachePost);
  if (cacheable && !options.forceRefresh) {
    const cached = getCached<T>(key);
    if (cached !== null) {
      if (import.meta.env.DEV) console.log("[Cache HIT]", key);
      return cached;
    }
    const pending = pendingRequests.get(key) as Promise<T> | undefined;
    if (pending) {
      if (import.meta.env.DEV) console.log("[Cache HIT]", `${key}:pending`);
      return pending;
    }
  }
  if (import.meta.env.DEV) console.log(options.forceRefresh ? "[Cache REFRESH]" : "[Cache MISS]", key);

  const request = (async () => {
    const { ttlMs: _ttlMs, forceRefresh: _forceRefresh, cachePost: _cachePost, parseResponse, ...fetchOptions } = options;
    const response = await fetch(url, fetchOptions);
    const parsed = await (parseResponse || defaultParse<T>)(response);
    if (cacheable) setCached(key, parsed, ttlMs);
    return parsed;
  })();

  if (cacheable) pendingRequests.set(key, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(key);
  }
};

export const cacheAgeLabel = (key: string) => {
  const memory = memoryCache.get(key);
  if (!memory) return "";
  const ageMs = Date.now() - memory.createdAt;
  if (ageMs < 60_000) return "updated just now";
  return `updated ${Math.round(ageMs / 60_000)} min ago`;
};
