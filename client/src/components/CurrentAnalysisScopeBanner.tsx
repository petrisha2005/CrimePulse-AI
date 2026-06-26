import { Database, Filter, MapPinned, RefreshCw, ShieldCheck } from "lucide-react";
import { getScopeLabel } from "../auth/accessScope";
import { useAuth } from "../auth/AuthContext";
import { useDatasetAnalytics } from "../context/DatasetAnalyticsContext";
import type { DashboardFilters, DashboardResponseMeta } from "../types/crime";

type CurrentAnalysisScopeBannerProps = {
  meta?: DashboardResponseMeta | null;
  filters?: DashboardFilters | Record<string, string | number | undefined | null>;
  recordsAnalyzed?: number;
  districtCount?: number;
  policeStationCount?: number;
  coordinateCoverage?: number;
  dataQuality?: number;
  cacheStatus?: "cached" | "fresh";
  onClearFilters?: () => void;
  hideWhenNoData?: boolean;
};

const filterLabels: Record<string, string> = {
  fir_year: "Year",
  year: "Year",
  fir_month: "Month",
  month: "Month",
  district: "District",
  police_station: "Police Station",
  crime_type: "Crime Group",
  crime_group: "Crime Group",
  severity: "Severity",
  fir_type: "FIR Type",
  fir_stage: "FIR Stage",
  status: "FIR Stage",
  complaint_mode: "Complaint Mode"
};

const activeFilterEntries = (filters?: CurrentAnalysisScopeBannerProps["filters"]) =>
  Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "" && String(value) !== "All" && String(value) !== "all");

const formatNumber = (value: number) => Number.isFinite(value) ? value.toLocaleString() : "0";
const formatPercent = (value?: number) => `${Math.round(Number(value || 0))}%`;

const scopeBadge = (analysisScope: string, isFiltered: boolean, hasRoleScope: boolean) => {
  if (hasRoleScope) return { label: "Role Scope", className: "border-command-300/45 bg-command-500/10 text-command-200" };
  if (isFiltered || analysisScope === "filtered_dataset") return { label: "Filtered View", className: "border-alert-medium/45 bg-alert-medium/10 text-alert-medium" };
  return { label: "Full Dataset", className: "border-alert-low/45 bg-alert-low/10 text-alert-low" };
};

const CurrentAnalysisScopeBanner = ({
  meta,
  filters,
  recordsAnalyzed,
  districtCount,
  policeStationCount,
  coordinateCoverage,
  dataQuality,
  cacheStatus,
  onClearFilters,
  hideWhenNoData = false
}: CurrentAnalysisScopeBannerProps) => {
  const { currentUser } = useAuth();
  const { totalRecords, globalStats, lastFetchedAt } = useDatasetAnalytics();
  const uploadedRecords = meta?.totalUploadedRecords ?? globalStats?.total_uploaded_records ?? globalStats?.total_records ?? totalRecords ?? 0;
  const appliedFilters = meta?.appliedFilters && Object.keys(meta.appliedFilters).length > 0 ? meta.appliedFilters : filters;
  const activeFilters = activeFilterEntries(appliedFilters);
  const hasFilters = meta?.isFiltered ?? activeFilters.length > 0;
  const hasRoleScope = currentUser?.accessScope?.type === "district" || currentUser?.accessScope?.type === "station";
  const analyzed = recordsAnalyzed ?? meta?.recordsAnalyzed ?? globalStats?.records_analyzed ?? uploadedRecords;
  const analysisScope = meta?.analysisScope ?? globalStats?.analysis_scope ?? (hasFilters ? "filtered_dataset" : "full_dataset");
  const districtTotal = districtCount ?? globalStats?.total_districts ?? 0;
  const stationTotal = policeStationCount ?? globalStats?.total_police_stations ?? 0;
  const coordinate = coordinateCoverage ?? globalStats?.coordinate_available_percentage;
  const quality = dataQuality ?? globalStats?.data_quality_score;
  const isCached = cacheStatus ? cacheStatus === "cached" : Boolean(meta?.isCached ?? globalStats?.is_cached);
  const cacheGeneratedAt = meta?.cacheGeneratedAt ?? globalStats?.cache_generated_at ?? lastFetchedAt;
  const badge = scopeBadge(analysisScope, hasFilters, hasRoleScope);

  if (hideWhenNoData && uploadedRecords === 0) return null;

  if (uploadedRecords === 0) {
    return (
      <section className="card-safe mb-6 border border-command-500/30 bg-command-500/5 p-4 shadow-glow" aria-label="Current analysis scope">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-command-500/40 bg-command-500/10 text-command-200">
            <Database className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-safe text-sm font-semibold text-slate-200">No crime data uploaded yet. Upload a CSV file to generate intelligence.</p>
        </div>
      </section>
    );
  }

  const noFilteredMatches = uploadedRecords > 0 && analyzed === 0 && hasFilters;

  return (
    <section className="card-safe mb-6 border border-command-500/30 bg-command-900/85 p-4 shadow-glow" aria-label="Current analysis scope">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-command-500/40 bg-command-500/10 text-command-200">
              {hasRoleScope ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Database className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${badge.className}`}>{badge.label}</span>
            {isCached && <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">Cached</span>}
            {!isCached && <span className="rounded-full border border-command-500/40 bg-command-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-command-200">Refreshed just now</span>}
          </div>
          <p className="mt-3 text-safe text-sm leading-6 text-slate-300">
            {noFilteredMatches ? (
              <span className="font-semibold text-alert-medium">No records match selected filters.</span>
            ) : hasFilters ? (
              <>Showing <span className="font-semibold text-white">{formatNumber(analyzed)}</span> matching records from <span className="font-semibold text-white">{formatNumber(uploadedRecords)}</span> uploaded records</>
            ) : hasRoleScope ? (
              <>{getScopeLabel(currentUser)} · Analyzing <span className="font-semibold text-white">{formatNumber(analyzed)}</span> records available to this role</>
            ) : (
              <>Analyzing <span className="font-semibold text-white">{formatNumber(analyzed)}</span> / <span className="font-semibold text-white">{formatNumber(uploadedRecords)}</span> uploaded records</>
            )}
          </p>
          {activeFilters.length > 0 && (
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Filter className="h-3.5 w-3.5" aria-hidden="true" /> Filters</span>
              {activeFilters.map(([key, value]) => (
                <span key={`${key}-${String(value)}`} className="max-w-full rounded border border-command-700 bg-command-850 px-2.5 py-1 text-xs text-slate-200" title={`${filterLabels[key] || key}: ${String(value)}`}>
                  <span className="text-slate-500">{filterLabels[key] || key}:</span> <span className="text-safe">{String(value)}</span>
                </span>
              ))}
              {onClearFilters && <button className="rounded border border-command-700 px-2.5 py-1 text-xs font-semibold text-command-300 hover:bg-command-850 hover:text-white" onClick={onClearFilters} type="button">Clear Filters</button>}
            </div>
          )}
        </div>
        <div className="grid min-w-0 gap-2 text-xs sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
          <div className="rounded-md border border-command-700 bg-command-850 p-3"><p className="text-slate-500">Districts</p><p className="mt-1 text-base font-semibold text-white">{formatNumber(districtTotal)}</p></div>
          <div className="rounded-md border border-command-700 bg-command-850 p-3"><p className="text-slate-500">Police Stations</p><p className="mt-1 text-base font-semibold text-white">{formatNumber(stationTotal)}</p></div>
          <div className="rounded-md border border-command-700 bg-command-850 p-3"><p className="text-slate-500">Geo Coverage</p><p className="mt-1 text-base font-semibold text-white">{formatPercent(coordinate)}</p></div>
          <div className="rounded-md border border-command-700 bg-command-850 p-3"><p className="text-slate-500">Data Quality</p><p className="mt-1 text-base font-semibold text-white">{formatPercent(quality)}</p></div>
        </div>
      </div>
      {cacheGeneratedAt && <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Scope refreshed {new Date(cacheGeneratedAt).toLocaleString()}</p>}
      {hasRoleScope && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-command-300">
          <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
          {currentUser?.accessScope?.type === "station" ? `Station scope: ${currentUser.assignedDistrict} · ${currentUser.assignedPoliceStation}` : `District scope: ${currentUser?.assignedDistrict}`}
        </p>
      )}
    </section>
  );
};

export default CurrentAnalysisScopeBanner;
