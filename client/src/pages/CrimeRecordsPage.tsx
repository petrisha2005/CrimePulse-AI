import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2, RefreshCw, Search } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import NoDataState from "../components/NoDataState";
import CrimeRecordDetailsDrawer from "../components/CrimeRecordDetailsDrawer";
import { useAuth } from "../auth/AuthContext";
import { useCrimeFilters } from "../hooks/useCrimeFilters";
import { getScopeLabel } from "../auth/accessScope";
import { crimeService } from "../services/crimeService";
import type { CrimeRecord, CrimeRecordFilterOptions, CrimeRecordQuery, CrimeRecordsPagination } from "../types/crime";

const allFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All"
};

const emptyOptions: CrimeRecordFilterOptions = {
  fir_year: [],
  fir_month: [],
  district: [],
  police_station: [],
  crime_type: [],
  severity: [],
  fir_stage: [],
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const emptyPagination: CrimeRecordsPagination = {
  page: 1,
  limit: 25,
  totalRecords: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

const fieldLabels: Array<[keyof CrimeRecord, string]> = [
  ["ROWID", "ROWID"],
  ["crime_id", "Crime ID"],
  ["district", "District"],
  ["police_station", "Police Station"],
  ["crime_type", "Crime Type"],
  ["crime_subtype", "Crime Head"],
  ["severity", "Severity"],
  ["severity_original", "Original Severity"],
  ["fir_year", "FIR Year"],
  ["fir_month", "FIR Month"],
  ["fir_day", "FIR Day"],
  ["crime_date", "Crime Date"],
  ["latitude_value", "Latitude"],
  ["longitude_value", "Longitude"],
  ["offence_location", "Offence Location"],
  ["beat_name", "Beat Name"],
  ["village_area_name", "Village/Area"],
  ["fir_stage", "FIR Stage"],
  ["complaint_mode", "Complaint Mode"],
  ["act_section", "Act Section"],
  ["victim_count", "Victim Count"],
  ["accused_count", "Accused Count"],
  ["arrested_count", "Arrested Count"],
  ["conviction_count", "Conviction Count"],
  ["unit_id", "Unit ID"],
  ["created_time", "Created Time"]
];

const FilterSelect = ({ label, value, options, onChange, locked = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; locked?: boolean }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={locked || options.length === 0}
    >
      <option value="All">{options.length === 0 ? "No options available" : "All"}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    {locked && <span className="mt-1 block normal-case tracking-normal text-[11px] text-command-300">Restricted by your role</span>}
    {!locked && options.length === 0 && <span className="mt-1 block normal-case tracking-normal text-[11px] text-slate-500">No values exist in the current dataset.</span>}
  </label>
);

const severityClass = {
  Low: "border-alert-low/40 bg-alert-low/15 text-alert-low",
  Medium: "border-alert-medium/40 bg-alert-medium/15 text-alert-medium",
  High: "border-alert-high/40 bg-alert-high/15 text-alert-high",
  Critical: "border-alert-critical/40 bg-alert-critical/15 text-alert-critical"
};

const CompactCell = ({ value, className = "" }: { value?: string | number | null; className?: string }) => (
  <span className={`block max-w-full truncate whitespace-nowrap ${className}`} title={String(value ?? "-")}>{String(value ?? "-") || "-"}</span>
);

const hasActiveFilters = (filters: typeof allFilters, search = "") =>
  Boolean(search.trim()) || Object.values(filters).some((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized !== "" && normalized !== "all";
  });

const CrimeRecordsPage = () => {
  const { currentUser, scopeParams } = useAuth();
  const scopedFilters = { ...allFilters, ...scopeParams };
  const districtLocked = Boolean(scopeParams.district);
  const stationLocked = Boolean(scopeParams.police_station);
  const [records, setRecords] = useState<CrimeRecord[]>([]);
  const [options, setOptions] = useState<CrimeRecordFilterOptions>(emptyOptions);
  const [filters, setFilters] = useState(scopedFilters);
  const [appliedFilters, setAppliedFilters] = useState(scopedFilters);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pagination, setPagination] = useState<CrimeRecordsPagination>(emptyPagination);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CrimeRecord | null>(null);
  const dynamicFilterSource = useCrimeFilters({ selectedDistrict: filters.district, selectedCrimeType: filters.crime_type, userRole: currentUser?.role, assignedDistrict: currentUser?.assignedDistrict, assignedPoliceStation: currentUser?.assignedPoliceStation });

  const query = useMemo<CrimeRecordQuery>(() => ({
    page,
    limit,
    search: appliedSearch,
    ...appliedFilters
  }), [page, limit, appliedSearch, appliedFilters]);

  useEffect(() => { setOptions({ ...emptyOptions, ...dynamicFilterSource.options }); }, [dynamicFilterSource.options]);

  const loadRecords = async (nextQuery = query) => {
    try {
      setLoading(true);
      setError("");
      const response = await crimeService.getCrimeRecordsPage(nextQuery);
      setRecords(response.data);
      setPagination(response.pagination || emptyPagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load crime records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFilters(scopedFilters);
    setAppliedFilters(scopedFilters);
    setPage(1);
  }, [currentUser?.id]);

  useEffect(() => {
    loadRecords(query);
  }, [page, limit, appliedFilters, appliedSearch]);

  const applyFilters = () => {
    setPage(1);
    setAppliedSearch(search);
    setAppliedFilters({ ...filters, ...scopeParams });
  };

  const clearFilters = () => {
    setFilters(scopedFilters);
    setAppliedFilters(scopedFilters);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const updateFilter = (key: keyof typeof allFilters, value: string) => {
    if ((key === "district" && districtLocked) || (key === "police_station" && stationLocked)) return;
    setFilters((current) => ({ ...current, [key]: value, ...(key === "district" && !stationLocked ? { police_station: "All" } : {}), ...scopeParams }));
  };

  const exportCsv = () => {
    const headers = fieldLabels.map(([, label]) => label);
    const rows = records.map((record) => fieldLabels.map(([field]) => `"${String(record[field] ?? "").replace(/"/g, '""')}"`));
    const csv = [headers.map((header) => `"${header}"`).join(","), ...rows.map((row) => row.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "crimepulse-current-crime-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && records.length === 0) {
    return (
      <div className="space-y-6">
        <StateBlock title="Loading crime records" message="Fetching stored Catalyst Data Store records." />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-md border border-command-700 bg-command-900/85" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Data Store</p>
          <h1 className="text-3xl font-semibold text-white">Crime Records</h1>
          <p className="mt-2 text-sm text-slate-400">Browse, search, filter, and inspect stored Karnataka crime records.</p><p className="mt-2 text-xs font-semibold text-command-300">{getScopeLabel(currentUser)}</p>
        </div>
        <button className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={exportCsv} type="button">
          <Download className="h-4 w-4" />
          Export Current View CSV
        </button>
      </div>

      <div className="stat-grid">
        <DashboardCard title="Total Records" value={pagination.totalRecords} icon={Search} />
        <DashboardCard title="Current Page Records" value={records.length} icon={RefreshCw} tone="green" />
        <DashboardCard title="Selected District" value={appliedFilters.district === "All" ? "All" : appliedFilters.district} icon={Search} tone="orange" />
        <DashboardCard title="Selected Crime Type" value={appliedFilters.crime_type === "All" ? "All" : appliedFilters.crime_type} icon={Search} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col gap-4">
          <label className="relative block">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              className="min-h-11 w-full rounded-md border border-command-700 bg-command-850 pl-10 pr-3 text-sm text-white outline-none focus:border-command-300"
              placeholder="Search by crime ID, district, police station, crime type, FIR stage, act section..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label="FIR Year" value={filters.fir_year} options={options.fir_year || options.years} onChange={(value) => updateFilter("fir_year", value)} />
            <FilterSelect label="FIR Month" value={filters.fir_month} options={options.fir_month || options.months} onChange={(value) => updateFilter("fir_month", value)} />
            <FilterSelect label="District" value={filters.district} options={options.district || options.districts} onChange={(value) => updateFilter("district", value)} locked={districtLocked} />
            <FilterSelect label="Police Station" value={filters.police_station} options={options.police_station || options.policeStations} onChange={(value) => updateFilter("police_station", value)} locked={stationLocked} />
            <FilterSelect label="Crime Type" value={filters.crime_type} options={options.crime_type || options.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
            <FilterSelect label="Severity" value={filters.severity} options={options.severity || options.severities} onChange={(value) => updateFilter("severity", value)} />
            <FilterSelect label="FIR Stage" value={filters.fir_stage} options={options.fir_stage || options.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={applyFilters} type="button">Apply Filters</button>
            <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={clearFilters} type="button">Clear Filters</button>
            <button className="flex items-center gap-2 rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => loadRecords(query)} type="button">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="space-y-3">
          <StateBlock title="Crime Records API failed" message={error} />
          <button className="rounded-md bg-command-500 px-4 py-3 font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadRecords(query)} type="button">Retry</button>
        </div>
      )}

      {!error && records.length === 0 ? (
        hasActiveFilters(appliedFilters, appliedSearch) ? (
          <section className="rounded-md border border-command-700 bg-command-900/85 p-6 text-center shadow-glow">
            <h2 className="text-2xl font-semibold text-white">No records match selected filters.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Try clearing filters or widening the search to inspect more stored records.</p>
            <button className="mt-5 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={clearFilters} type="button">
              Clear Filters
            </button>
          </section>
        ) : (
          <NoDataState currentUser={currentUser} moduleName="Crime Records" />
        )
      ) : (
        <section className="overflow-hidden rounded-md border border-command-700 bg-command-900/85 shadow-glow">
          <div className="table-scroll">
            <table className="data-table hidden min-w-full table-fixed text-left text-sm md:table">
              <thead className="sticky top-0 bg-command-850 text-xs uppercase text-slate-400">
                <tr>
                  <th className="w-40 whitespace-nowrap px-3 py-3">Crime ID</th>
                  <th className="w-36 whitespace-nowrap px-3 py-3">District</th>
                  <th className="w-52 whitespace-nowrap px-3 py-3">Police Station</th>
                  <th className="w-56 whitespace-nowrap px-3 py-3">Crime Type</th>
                  <th className="w-28 whitespace-nowrap px-3 py-3">Severity</th>
                  <th className="w-24 whitespace-nowrap px-3 py-3">FIR Year</th>
                  <th className="w-24 whitespace-nowrap px-3 py-3">FIR Month</th>
                  <th className="w-32 whitespace-nowrap px-3 py-3 text-right">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-command-700/70">
                {records.map((record) => (
                  <tr key={record.ROWID || record.crime_id} className="hover:bg-command-850/70">
                    <td className="px-3 py-3 font-medium text-command-300">
                      <button className="block max-w-full truncate whitespace-nowrap hover:text-white" title={record.crime_id} onClick={() => setSelected(record)} type="button">{record.crime_id}</button>
                    </td>
                    <td className="px-3 py-3 text-slate-200"><CompactCell value={record.district} /></td>
                    <td className="px-3 py-3 text-slate-300"><CompactCell value={record.police_station} /></td>
                    <td className="px-3 py-3 text-slate-300"><CompactCell value={record.crime_type} /></td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={`rounded border px-2 py-1 text-xs font-semibold ${severityClass[record.severity] || severityClass.Low}`}>
                        {record.severity || "Low"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{record.fir_year || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{record.fir_month || "-"}</td>
                    <td className="px-3 py-3 text-right">
                      <button className="inline-flex items-center gap-2 rounded border border-command-700 px-3 py-2 text-xs font-semibold text-command-300 hover:bg-command-800" onClick={() => setSelected(record)} type="button">
                        <Eye className="h-4 w-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid gap-3 p-3 md:hidden">
              {records.map((record) => (
                <button key={record.ROWID || record.crime_id} className="rounded-md border border-command-700 bg-command-850 p-4 text-left" onClick={() => setSelected(record)} type="button">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-command-300" title={record.crime_id}>{record.crime_id}</p>
                      <p className="mt-1 truncate text-sm text-white" title={record.crime_type}>{record.crime_type}</p>
                      <p className="mt-1 truncate text-xs text-slate-400" title={`${record.district} · ${record.police_station}`}>{record.district} · {record.police_station}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${severityClass[record.severity] || severityClass.Low}`}>{record.severity || "Low"}</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">FIR {record.fir_year || "-"} · Month {record.fir_month || "-"}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-command-700 px-4 py-4 text-sm text-slate-300 md:flex-row md:items-center">
            <div>Page {pagination.page} of {pagination.totalPages} • {pagination.totalRecords.toLocaleString()} records</div>
            <div className="flex flex-wrap items-center gap-3">
              <select className="rounded border border-command-700 bg-command-850 px-3 py-2 text-white" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
              </select>
              <button className="rounded border border-command-700 px-3 py-2 disabled:opacity-40" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button>
              <button className="rounded border border-command-700 px-3 py-2 disabled:opacity-40" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          </div>
        </section>
      )}

      <CrimeRecordDetailsDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CrimeRecordsPage;
