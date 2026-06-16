import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Database,
  Download,
  Gavel,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  Siren,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  DistributionPieChart,
  MonthlyTrendChart,
  RankingBarChart,
  YearlyTrendChart
} from "../components/ChartPanel";
import CrimeTable from "../components/CrimeTable";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { dashboardService } from "../services/dashboardService";
import { crimeService } from "../services/crimeService";
import type {
  ChartDatum,
  CrimeRecord,
  DashboardFilterOptions,
  DashboardFilters,
  DashboardSummary,
  GlobalStats,
  MonthlyTrend,
  YearlyTrend
} from "../types/crime";

const emptyFilters: DashboardFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All"
};

const emptyFilterOptions: DashboardFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const SelectFilter = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value || "All"}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="All">All</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

const hasActiveFilters = (filters: DashboardFilters) =>
  Object.values(filters).some((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized !== "" && normalized !== "all";
  });

const RankingTable = ({ title, data }: { title: string; data: ChartDatum[] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    {data.length === 0 ? (
      <p className="mt-4 text-sm text-slate-400">No ranking data available.</p>
    ) : (
      <div className="mt-4 overflow-hidden rounded border border-command-700">
        <table className="min-w-full divide-y divide-command-700 text-sm">
          <thead className="bg-command-850 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">Rank</th>
              <th className="px-3 py-3 text-left">Name</th>
              <th className="px-3 py-3 text-right">Crimes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-command-700/70">
            {data.slice(0, 10).map((item, index) => (
              <tr key={item.name} className="hover:bg-command-850/70">
                <td className="px-3 py-3 text-command-300">{index + 1}</td>
                <td className="px-3 py-3 text-slate-200">{item.name}</td>
                <td className="px-3 py-3 text-right font-semibold text-white">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions>(emptyFilterOptions);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [yearlyTrends, setYearlyTrends] = useState<YearlyTrend[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<ChartDatum[]>([]);
  const [districtRanking, setDistrictRanking] = useState<ChartDatum[]>([]);
  const [policeStationRanking, setPoliceStationRanking] = useState<ChartDatum[]>([]);
  const [crimeGroupRanking, setCrimeGroupRanking] = useState<ChartDatum[]>([]);
  const [crimeHeadRanking, setCrimeHeadRanking] = useState<ChartDatum[]>([]);
  const [firStages, setFirStages] = useState<ChartDatum[]>([]);
  const [complaintModes, setComplaintModes] = useState<ChartDatum[]>([]);
  const [recentRecords, setRecentRecords] = useState<CrimeRecord[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [storedRecordCount, setStoredRecordCount] = useState<number | null>(null);
  const [dashboardApiFailed, setDashboardApiFailed] = useState(false);
  const [dashboardErrorDetail, setDashboardErrorDetail] = useState("");

  const loadFilterOptions = async () => {
    try {
      const response = await dashboardService.getFilters();
      setFilterOptions(response.data);
    } catch {
      setFilterOptions(emptyFilterOptions);
    }
  };

  const loadDashboard = async (nextFilters: DashboardFilters, silent = false) => {
    let latestRecordCount = storedRecordCount ?? 0;
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      setDashboardApiFailed(false);
      setDashboardErrorDetail("");

      const countResponse = await crimeService.getCrimeCount();
      const totalRecords = countResponse.totalRecords ?? countResponse.data?.totalRecords ?? 0;
      latestRecordCount = totalRecords;
      setStoredRecordCount(totalRecords);
      if (totalRecords === 0) {
        setGlobalStats(null);
        setSummary(null);
        setMonthlyTrends([]);
        setYearlyTrends([]);
        setCrimeTypes([]);
        setDistrictRanking([]);
        setPoliceStationRanking([]);
        setCrimeGroupRanking([]);
        setCrimeHeadRanking([]);
        setFirStages([]);
        setComplaintModes([]);
        setRecentRecords([]);
        return;
      }

      const [
        globalStatsRes,
        summaryRes,
        monthlyRes,
        yearlyRes,
        crimeTypeRes,
        districtRes,
        stationRes,
        groupRes,
        headRes,
        firStageRes,
        complaintRes,
        recentRes
      ] = await Promise.all([
        dashboardService.getGlobalStats(),
        dashboardService.getSummary(nextFilters),
        dashboardService.getMonthlyTrends(nextFilters),
        dashboardService.getYearlyTrends(nextFilters),
        dashboardService.getCrimeTypes(nextFilters),
        dashboardService.getDistrictRanking(nextFilters),
        dashboardService.getPoliceStationRanking(nextFilters),
        dashboardService.getCrimeGroupRanking(nextFilters),
        dashboardService.getCrimeHeadRanking(nextFilters),
        dashboardService.getFirStageSummary(nextFilters),
        dashboardService.getComplaintModeSummary(nextFilters),
        dashboardService.getRecentRecords(nextFilters)
      ]);

      setGlobalStats(globalStatsRes.data);
      setSummary(summaryRes.data);
      setMonthlyTrends(monthlyRes.data);
      setYearlyTrends(yearlyRes.data);
      setCrimeTypes(crimeTypeRes.data);
      setDistrictRanking(districtRes.data);
      setPoliceStationRanking(stationRes.data);
      setCrimeGroupRanking(groupRes.data);
      setCrimeHeadRanking(headRes.data);
      setFirStages(firStageRes.data);
      setComplaintModes(complaintRes.data);
      setRecentRecords(recentRes.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load dashboard analytics.";
      setDashboardApiFailed(latestRecordCount > 0);
      setDashboardErrorDetail(message);
      setError(
        latestRecordCount > 0
          ? `${latestRecordCount.toLocaleString()} records found. Dashboard analytics API failed.`
          : message
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    loadDashboard(appliedFilters);
  }, []);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    loadDashboard(filters, true);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    loadDashboard(emptyFilters, true);
  };

  const exportSummaryCsv = () => {
    if (!summary) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Reported Crimes", summary.totalCrimes],
      ["Districts Covered", summary.totalDistricts],
      ["Police Stations", summary.totalPoliceStations],
      ["Most Reported Crime Type", summary.mostReportedCrimeType],
      ["Heinous Crimes", summary.heinousCrimeCount],
      ["Non-Heinous Crimes", summary.nonHeinousCrimeCount],
      ["Total Victims", summary.totalVictims],
      ["Total Accused", summary.totalAccused],
      ["Total Arrests", summary.totalArrests],
      ["Total Convictions", summary.totalConvictions],
      ["Coordinate Availability", `${summary.coordinateAvailablePercentage}%`]
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crimepulse-dashboard-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const totalCrimes = storedRecordCount ?? summary?.totalCrimes ?? 0;
  const filteredViewActive = hasActiveFilters(appliedFilters);

  if (loading) {
    return (
      <div className="space-y-6">
        <StateBlock title="Loading command dashboard" message="Aggregating Catalyst Data Store intelligence." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-md border border-command-700 bg-command-900/85" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock title="Dashboard unavailable" message={error} />
        {dashboardApiFailed && (storedRecordCount ?? 0) > 0 && (
          <section className="rounded-md border border-alert-medium/40 bg-alert-medium/10 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-alert-medium">Stored records detected</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border border-command-700 bg-command-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Count API</p>
                <p className="mt-1 font-semibold text-alert-low">working</p>
              </div>
              <div className="rounded border border-command-700 bg-command-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Stored Records</p>
                <p className="mt-1 font-semibold text-white">{(storedRecordCount ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded border border-command-700 bg-command-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Dashboard API</p>
                <p className="mt-1 font-semibold text-alert-critical">failed</p>
              </div>
              <div className="rounded border border-command-700 bg-command-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Suggested Fix</p>
                <p className="mt-1 font-semibold text-slate-200">check dashboard-api aggregation</p>
              </div>
            </div>
            {dashboardErrorDetail && (
              <details className="mt-4 rounded border border-command-700 bg-command-900/80 p-3 text-sm text-slate-300">
                <summary className="cursor-pointer font-semibold text-white">Error details</summary>
                <p className="mt-3 whitespace-pre-wrap break-words">{dashboardErrorDetail}</p>
                <p className="mt-3 text-command-300">Count API result: {(storedRecordCount ?? 0).toLocaleString()} stored records detected.</p>
              </details>
            )}
          </section>
        )}
        <button
          className="rounded-md bg-command-500 px-4 py-3 font-semibold text-white hover:bg-command-300 hover:text-command-950"
          onClick={() => loadDashboard(appliedFilters, true)}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (totalCrimes === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Crime Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Crime Command Dashboard</h1>
          <p className={`mt-2 text-sm font-medium ${filteredViewActive ? "text-alert-medium" : "text-alert-low"}`}>
            {filteredViewActive ? "Filtered view active" : "Showing all records"}
          </p>
        </div>
        <StateBlock
          title="No crime records stored yet"
          message="Upload CSV data first. Dashboard analytics activate only after records are confirmed in Catalyst Data Store."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Crime Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Crime Command Dashboard</h1>
        </div>
        <button
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800 disabled:opacity-60"
          disabled={refreshing}
          onClick={() => loadDashboard(appliedFilters, true)}
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Dashboard
        </button>
        <button
          className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950"
          onClick={exportSummaryCsv}
          type="button"
        >
          <Download className="h-4 w-4" />
          Export Summary CSV
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold text-white">Filters</h2>
          <span className={`rounded border px-3 py-1 text-xs font-semibold ${filteredViewActive ? "border-alert-medium/40 bg-alert-medium/10 text-alert-medium" : "border-alert-low/40 bg-alert-low/10 text-alert-low"}`}>
            {filteredViewActive ? "Filtered view active" : "Showing all records"}
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="FIR Year" value={filters.fir_year} options={filterOptions.years} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={filterOptions.months} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="District" value={filters.district} options={filterOptions.districts} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={filterOptions.policeStations} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Group" value={filters.crime_type} options={filterOptions.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="FIR Type / Severity" value={filters.severity} options={filterOptions.severities} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={filterOptions.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={applyFilters} type="button">
            Apply Filters
          </button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={clearFilters} type="button">
            Clear Filters
          </button>
        </div>
      </section>

      {globalStats && (
        <section className="grid gap-3 rounded-md border border-command-700 bg-command-900/85 p-4 text-sm shadow-glow md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Stored Records</p>
            <p className="mt-1 font-semibold text-white">{globalStats.total_records.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Districts</p>
            <p className="mt-1 font-semibold text-white">{globalStats.total_districts}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Coordinates</p>
            <p className="mt-1 font-semibold text-white">{globalStats.coordinate_available_percentage}% available</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Quality</p>
            <p className="mt-1 font-semibold text-white">{globalStats.data_quality_score}%</p>
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Total Reported Crimes" value={summary?.totalCrimes ?? 0} icon={Database} />
        <DashboardCard title="Districts Covered" value={summary?.totalDistricts ?? 0} icon={Building2} tone="green" />
        <DashboardCard title="Police Stations" value={summary?.totalPoliceStations ?? 0} icon={MapPinned} />
        <DashboardCard title="Most Reported Crime Type" value={summary?.mostReportedCrimeType || "No data"} icon={ShieldAlert} tone="orange" />
        <DashboardCard title="Heinous Crimes" value={summary?.heinousCrimeCount ?? 0} icon={Siren} tone="red" />
        <DashboardCard title="Non-Heinous Crimes" value={summary?.nonHeinousCrimeCount ?? 0} icon={BadgeCheck} tone="green" />
        <DashboardCard title="Total Victims" value={summary?.totalVictims ?? 0} icon={Users} tone="orange" />
        <DashboardCard title="Total Accused" value={summary?.totalAccused ?? 0} icon={AlertTriangle} tone="red" />
        <DashboardCard title="Total Arrests" value={summary?.totalArrests ?? 0} icon={BadgeCheck} />
        <DashboardCard title="Total Convictions" value={summary?.totalConvictions ?? 0} icon={Gavel} tone="green" />
        <DashboardCard title="Coordinate Availability" value={`${summary?.coordinateAvailablePercentage ?? 0}%`} icon={MapPinned} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MonthlyTrendChart data={monthlyTrends} />
        <YearlyTrendChart data={yearlyTrends} />
        <DistributionPieChart title="Crime Type Distribution" data={crimeTypes} />
        <RankingBarChart title="District-wise Crime Count" data={districtRanking.slice(0, 10)} />
        <RankingBarChart title="FIR Stage Distribution" data={firStages} color="#f97316" />
        <RankingBarChart title="Complaint Mode Distribution" data={complaintModes} color="#22c55e" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingTable title="Top 10 Districts by Crime Count" data={districtRanking} />
        <RankingTable title="Top 10 Police Stations by Crime Count" data={policeStationRanking} />
        <RankingTable title="Top 10 Crime Groups" data={crimeGroupRanking} />
        <RankingTable title="Top 10 Crime Heads" data={crimeHeadRanking} />
      </div>

      <CrimeTable records={recentRecords} />
    </div>
  );
};

export default Dashboard;
