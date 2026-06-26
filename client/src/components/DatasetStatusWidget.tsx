import { Activity, Database, MapPinned, ShieldCheck } from "lucide-react";
import type { GlobalStats } from "../types/crime";

interface DatasetStatusWidgetProps {
  stats: GlobalStats | null;
  compact?: boolean;
}

const formatNumber = (value?: number) => (value ?? 0).toLocaleString();

const DatasetStatusWidget = ({ stats, compact = false }: DatasetStatusWidgetProps) => {
  const score = stats?.data_quality_score ?? 0;
  const hasData = (stats?.total_records ?? 0) > 0;
  const partialStats = hasData && stats?.partial;
  const uploadedRecords = stats?.total_uploaded_records ?? stats?.total_records ?? 0;
  const recordsAnalyzed = stats?.records_analyzed ?? stats?.total_records ?? 0;
  const analysisLabel = stats?.is_sampled
    ? `Sampled ${formatNumber(recordsAnalyzed)} / ${formatNumber(uploadedRecords)} records`
    : `Analyzing ${formatNumber(recordsAnalyzed)} / ${formatNumber(uploadedRecords)} records`;
  const cacheLabel = stats?.is_cached ? "Cached" : "Live";

  if (compact) {
    return (
      <div className="hidden max-w-[46rem] items-center gap-3 overflow-hidden rounded-md border border-command-700 bg-command-850 px-3 py-2 text-xs xl:flex">
        <Database className="h-4 w-4 shrink-0 text-command-300" />
        <span className="text-slate-400">Dataset:</span>
        <span className={hasData ? "text-command-300" : "text-alert-medium"}>{hasData ? analysisLabel : "No records"}</span>
        {hasData && <span className="rounded border border-command-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-command-300">{cacheLabel}</span>}
        {partialStats ? (
          <>
            <span className="text-slate-600">|</span>
            <span className="max-w-40 truncate text-alert-medium" title={stats?.message || "analytics loading/unavailable"}>{stats?.message || "analytics loading/unavailable"}</span>
          </>
        ) : (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{stats?.total_districts ?? 0} districts</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{stats?.coordinate_available_percentage ?? 0}% geo</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{score}% quality</span>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="card-safe rounded-md border border-command-700 bg-command-900/85 p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-command-300">Dataset Status</p>
          <h2 className="text-safe mt-1 text-base font-semibold text-white">{hasData ? "Using uploaded Karnataka crime dataset" : "Waiting for uploaded crime data"}</h2>
        </div>
        <span className={`rounded border px-3 py-1 text-xs font-semibold ${hasData ? "border-alert-low/40 bg-alert-low/10 text-alert-low" : "border-alert-medium/40 bg-alert-medium/10 text-alert-medium"}`}>
          {hasData ? "Live Data" : "Empty"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <Database className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Crime Records</p>
          <p className="text-lg font-semibold text-white">{formatNumber(uploadedRecords)}</p>
          {hasData && <p className="mt-1 text-[11px] text-command-300">{analysisLabel}</p>}
        </div>
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <MapPinned className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Districts Covered</p>
          <p className="text-lg font-semibold text-white">{stats?.total_districts ?? 0}</p>
        </div>
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <Activity className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Years Covered</p>
          <p className="text-lg font-semibold text-white">{stats?.year_range || "No data"}</p>
        </div>
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <ShieldCheck className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Data Quality</p>
          <p className="text-lg font-semibold text-white">{score}%</p>
        </div>
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <MapPinned className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Coordinates</p>
          <p className="text-lg font-semibold text-white">{stats?.coordinate_available_percentage ?? 0}%</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatNumber(stats?.records_with_coordinates)} with / {formatNumber(stats?.records_without_coordinates)} without
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Last updated: {stats?.cache_generated_at || stats?.last_updated ? new Date(stats.cache_generated_at || stats.last_updated).toLocaleString() : "Data not available"}{hasData ? ` · ${cacheLabel}` : ""}</p>
      {partialStats && <p className="mt-2 text-xs text-alert-medium">{stats?.message || "Analytics are temporarily unavailable, but stored records were found."}</p>}
    </section>
  );
};

export default DatasetStatusWidget;
