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

  if (compact) {
    return (
      <div className="hidden items-center gap-3 rounded-md border border-command-700 bg-command-850 px-3 py-2 text-xs xl:flex">
        <Database className="h-4 w-4 text-command-300" />
        <span className="text-slate-400">Dataset</span>
        <span className={hasData ? "text-command-300" : "text-alert-medium"}>{hasData ? `${formatNumber(stats?.total_records)} records` : "No records"}</span>
        {partialStats ? (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-alert-medium">{stats?.message || "analytics loading/unavailable"}</span>
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
    <section className="rounded-md border border-command-700 bg-command-900/85 p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-command-300">Dataset Status</p>
          <h2 className="mt-1 text-base font-semibold text-white">{hasData ? "Using uploaded Karnataka crime dataset" : "Waiting for uploaded crime data"}</h2>
        </div>
        <span className={`rounded border px-3 py-1 text-xs font-semibold ${hasData ? "border-alert-low/40 bg-alert-low/10 text-alert-low" : "border-alert-medium/40 bg-alert-medium/10 text-alert-medium"}`}>
          {hasData ? "Live Data" : "Empty"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded border border-command-700 bg-command-850 p-3">
          <Database className="h-4 w-4 text-command-300" />
          <p className="mt-2 text-xs text-slate-500">Crime Records</p>
          <p className="text-lg font-semibold text-white">{formatNumber(stats?.total_records)}</p>
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
      <p className="mt-3 text-xs text-slate-500">Last updated: {stats?.last_updated ? new Date(stats.last_updated).toLocaleString() : "Data not available"}</p>
      {partialStats && <p className="mt-2 text-xs text-alert-medium">{stats?.message || "Analytics are temporarily unavailable, but stored records were found."}</p>}
    </section>
  );
};

export default DatasetStatusWidget;
