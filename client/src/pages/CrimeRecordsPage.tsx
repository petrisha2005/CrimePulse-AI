import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2, RefreshCw, Search, X } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import NoDataState from "../components/NoDataState";
import { useAuth } from "../auth/AuthContext";
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
      disabled={locked}
    >
      <option value="All">All</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    {locked && <span className="mt-1 block normal-case tracking-normal text-[11px] text-command-300">Restricted by your role</span>}
  </label>
);

const dataQualityNotes = (record: CrimeRecord) => {
  const missingRequired = ["district", "police_station", "crime_type", "fir_year", "fir_month", "fir_day"].filter((field) => !String(record[field as keyof CrimeRecord] ?? "").trim());
  const coordinatesAvailable = record.latitude_value !== null && record.latitude_value !== undefined && record.longitude_value !== null && record.longitude_value !== undefined;
  return {
    coordinatesAvailable,
    missingRequired
  };
};

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

  const query = useMemo<CrimeRecordQuery>(() => ({
    page,
    limit,
    search: appliedSearch,
    ...appliedFilters
  }), [page, limit, appliedSearch, appliedFilters]);

  const loadOptions = async () => {
    try {
      const response = await crimeService.getCrimeRecordFilters();
      setOptions(response.data);
    } catch {
      setOptions(emptyOptions);
    }
  };

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
    loadOptions();
  }, []);

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

  const selectedQuality = selected ? dataQualityNotes(selected) : null;

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
            <FilterSelect label="FIR Year" value={filters.fir_year} options={options.fir_year || options.years} onChange={(value) => setFilters((current) => ({ ...current, fir_year: value }))} />
            <FilterSelect label="FIR Month" value={filters.fir_month} options={options.fir_month || options.months} onChange={(value) => setFilters((current) => ({ ...current, fir_month: value }))} />
            <FilterSelect label="District" value={filters.district} options={options.district || options.districts} onChange={(value) => setFilters((current) => ({ ...current, district: value }))} locked={districtLocked} />
            <FilterSelect label="Police Station" value={filters.police_station} options={options.police_station || options.policeStations} onChange={(value) => setFilters((current) => ({ ...current, police_station: value }))} locked={stationLocked} />
            <FilterSelect label="Crime Type" value={filters.crime_type} options={options.crime_type || options.crimeTypes} onChange={(value) => setFilters((current) => ({ ...current, crime_type: value }))} />
            <FilterSelect label="Severity" value={filters.severity} options={options.severity || options.severities} onChange={(value) => setFilters((current) => ({ ...current, severity: value }))} />
            <FilterSelect label="FIR Stage" value={filters.fir_stage} options={options.fir_stage || options.statuses} onChange={(value) => setFilters((current) => ({ ...current, fir_stage: value }))} />
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
        <NoDataState currentUser={currentUser} moduleName="Crime Records" />
      ) : (
        <section className="overflow-hidden rounded-md border border-command-700 bg-command-900/85 shadow-glow">
          <div className="table-scroll">
            <table className="data-table min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-command-850 text-xs uppercase text-slate-400">
                <tr>
                  {["Crime ID", "District", "Police Station", "Crime Type", "Crime Head", "Severity", "FIR Year", "FIR Month", "FIR Day", "Crime Date", "FIR Stage", "Complaint Mode", "Actions"].map((header) => (
                    <th key={header} className="whitespace-nowrap px-3 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-command-700/70">
                {records.map((record) => (
                  <tr key={record.ROWID || record.crime_id} className="hover:bg-command-850/70">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-command-300">{record.crime_id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-200">{record.district}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{record.police_station}</td>
                    <td className="min-w-48 px-3 py-3 text-slate-300">{record.crime_type}</td>
                    <td className="min-w-48 px-3 py-3 text-slate-300">{record.crime_subtype}</td>
                    <td className="px-3 py-3 text-slate-300">{record.severity}</td>
                    <td className="px-3 py-3 text-slate-300">{record.fir_year}</td>
                    <td className="px-3 py-3 text-slate-300">{record.fir_month}</td>
                    <td className="px-3 py-3 text-slate-300">{record.fir_day}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{record.crime_date || "-"}</td>
                    <td className="min-w-36 px-3 py-3 text-slate-300">{record.fir_stage || "-"}</td>
                    <td className="min-w-36 px-3 py-3 text-slate-300">{record.complaint_mode || "-"}</td>
                    <td className="px-3 py-3">
                      <button className="inline-flex items-center gap-2 rounded border border-command-700 px-3 py-2 text-xs font-semibold text-command-300 hover:bg-command-800" onClick={() => setSelected(record)} type="button">
                        <Eye className="h-4 w-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {selected && selectedQuality && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border border-command-700 bg-command-900 p-5 shadow-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-command-300">Record Details</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{selected.crime_id}</h2>
              </div>
              <button className="rounded border border-command-700 p-2 text-slate-300 hover:bg-command-850" onClick={() => setSelected(null)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fieldLabels.map(([field, label]) => (
                <div key={field} className="rounded border border-command-700 bg-command-850 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium text-white">{String(selected[field] ?? "-") || "-"}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded border border-command-700 bg-command-850 p-4">
                <h3 className="font-semibold text-white">Location Information</h3>
                <p className="mt-2 text-sm text-slate-300">{selected.offence_location || "Location not available"}</p>
                <p className="mt-1 text-xs text-slate-500">Coordinates: {selectedQuality.coordinatesAvailable ? `${selected.latitude_value}, ${selected.longitude_value}` : "Missing"}</p>
              </div>
              <div className="rounded border border-command-700 bg-command-850 p-4">
                <h3 className="font-semibold text-white">FIR Information</h3>
                <p className="mt-2 text-sm text-slate-300">Stage: {selected.fir_stage || "Not available"}</p>
                <p className="mt-1 text-sm text-slate-300">Complaint mode: {selected.complaint_mode || "Not available"}</p>
                <p className="mt-1 text-sm text-slate-300">Act section: {selected.act_section || "Not available"}</p>
              </div>
              <div className="rounded border border-command-700 bg-command-850 p-4">
                <h3 className="font-semibold text-white">Data Quality Notes</h3>
                <p className={`mt-2 text-sm ${selectedQuality.coordinatesAvailable ? "text-alert-low" : "text-alert-medium"}`}>
                  Coordinates {selectedQuality.coordinatesAvailable ? "available" : "missing"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Required fields {selectedQuality.missingRequired.length === 0 ? "available" : `missing: ${selectedQuality.missingRequired.join(", ")}`}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CrimeRecordsPage;
