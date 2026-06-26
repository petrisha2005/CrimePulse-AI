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
import CurrentAnalysisScopeBanner from "../components/CurrentAnalysisScopeBanner";
import { GuidedJourney, RecommendedNextStep } from "../components/ModuleGuide";
import StateBlock from "../components/StateBlock";
import NoDataState from "../components/NoDataState";
import { useAuth } from "../auth/AuthContext";
import { useDatasetAnalytics } from "../context/DatasetAnalyticsContext";
import { useCrimeFilters } from "../hooks/useCrimeFilters";
import { getScopeLabel } from "../auth/accessScope";
import { dashboardService } from "../services/dashboardService";
import { downloadProfessionalWorkbook } from "../utils/professionalWorkbook";
import type {
  ChartDatum,
  CrimeRecord,
  DashboardFilterOptions,
  DashboardFilters,
  DashboardResponseMeta,
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
  onChange,
  locked = false
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  locked?: boolean;
}) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value || "All"}
      onChange={(event) => onChange(event.target.value)}
      disabled={locked || options.length === 0}
    >
      <option value="All">{options.length === 0 ? "No options available" : "All"}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    {locked && <span className="mt-1 block normal-case tracking-normal text-[11px] text-command-300">Restricted by your role</span>}
    {!locked && options.length === 0 && <span className="mt-1 block normal-case tracking-normal text-[11px] text-slate-500">No values exist in the current dataset.</span>}
  </label>
);

const dashboardProfile = (role: string, district?: string, policeStation?: string) => {
  if (role === "district_officer") return { title: `${district || "Assigned"} District Command Dashboard`, subtitle: "District-level crime risk and response intelligence." };
  if (role === "station_officer") return { title: `${policeStation || "Assigned"} Station Dashboard`, subtitle: "Station-level alerts, records, and action priorities." };
  if (role === "crime_analyst") return { title: "Crime Intelligence Analysis Dashboard", subtitle: "Pattern discovery, trends, and predictive signals from uploaded records." };
  return { title: "State Command Dashboard", subtitle: "Statewide crime intelligence overview." };
};

const hasActiveFilters = (filters: DashboardFilters) =>
  Object.values(filters).some((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized !== "" && normalized !== "all";
  });

const dashboardFilterStorageKey = (userId?: string) => `crimepulse_dashboard_applied_filters_${userId || "anonymous"}`;

const readStoredDashboardFilters = (key: string, fallback: DashboardFilters): DashboardFilters => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "null") as DashboardFilters | null;
    return parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
};

const saveStoredDashboardFilters = (key: string, filters: DashboardFilters) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // Session filter memory is only a navigation convenience.
  }
};

const activeFilterEntries = (filters: object) =>
  Object.entries(filters as Record<string, unknown>).filter(([, value]) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized !== "" && normalized !== "all";
  });

const RankingTable = ({ title, data }: { title: string; data: ChartDatum[] }) => (
  <section className="card-safe rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-safe truncate-2 text-base font-semibold text-white" title={title}>{title}</h2>
    {data.length === 0 ? (
      <p className="mt-4 text-sm text-slate-400">No ranking data available.</p>
    ) : (
      <div className="table-scroll mt-4 rounded border border-command-700">
        <table className="data-table min-w-full divide-y divide-command-700 text-sm">
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
                <td className="px-3 py-3 text-slate-200" title={item.name}>{item.name}</td>
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
  const { currentUser, scopeParams, preferences, updatePreferences, canAccessRoute } = useAuth();
  const { totalRecords: sharedTotalRecords, globalStats: sharedGlobalStats, refreshAnalytics } = useDatasetAnalytics();
  const profile = dashboardProfile(currentUser?.role || "super_admin", currentUser?.assignedDistrict, currentUser?.assignedPoliceStation);
  const scopeLabel = getScopeLabel(currentUser);
  const scopedDefaults: DashboardFilters = { ...emptyFilters, ...scopeParams };
  const filterStorageKey = dashboardFilterStorageKey(currentUser?.id);
  const initialDashboardFilters = readStoredDashboardFilters(filterStorageKey, scopedDefaults);
  const districtLocked = Boolean(scopeParams.district);
  const stationLocked = Boolean(scopeParams.police_station);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialDashboardFilters);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialDashboardFilters);
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
  const [dashboardMeta, setDashboardMeta] = useState<DashboardResponseMeta | null>(null);
  const [storedRecordCount, setStoredRecordCount] = useState<number | null>(null);
  const [dashboardApiFailed, setDashboardApiFailed] = useState(false);
  const [dashboardErrorDetail, setDashboardErrorDetail] = useState("");
  const dynamicFilterSource = useCrimeFilters({ selectedDistrict: draftFilters.district, selectedCrimeType: draftFilters.crime_type, userRole: currentUser?.role, assignedDistrict: currentUser?.assignedDistrict, assignedPoliceStation: currentUser?.assignedPoliceStation });

  useEffect(() => { setFilterOptions({ ...emptyFilterOptions, years: dynamicFilterSource.options.years, months: dynamicFilterSource.options.months, districts: dynamicFilterSource.options.districts, policeStations: dynamicFilterSource.options.policeStations, crimeTypes: dynamicFilterSource.options.crimeTypes, severities: dynamicFilterSource.options.severities, statuses: dynamicFilterSource.options.statuses }); }, [dynamicFilterSource.options]);

  const loadDashboard = async (nextFilters: DashboardFilters, silent = false) => {
    let latestRecordCount = storedRecordCount ?? 0;
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      setDashboardApiFailed(false);
      setDashboardErrorDetail("");

      const totalRecords = sharedTotalRecords || storedRecordCount || 0;
      latestRecordCount = totalRecords;
      setStoredRecordCount(totalRecords);
      if (totalRecords === 0) {
        setGlobalStats(null);
        setDashboardMeta(null);
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

      setGlobalStats(sharedGlobalStats);
      setDashboardMeta(summaryRes.meta || null);
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
    const storedFilters = readStoredDashboardFilters(filterStorageKey, scopedDefaults);
    const nextFilters = { ...storedFilters, ...scopeParams };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    loadDashboard(nextFilters);
  }, [currentUser?.id, sharedTotalRecords, sharedGlobalStats]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    if ((key === "district" && districtLocked) || (key === "police_station" && stationLocked)) return;
    setDraftFilters((current) => {
      const next = { ...current, [key]: value, ...(key === "district" && !stationLocked ? { police_station: "All" } : {}), ...scopeParams };
      if (import.meta.env.DEV) console.log("[Dashboard Filters] Draft filters:", next);
      return next;
    });
  };

  const applyFilters = () => {
    const scopedFilters = { ...draftFilters, ...scopeParams };
    if (import.meta.env.DEV) {
      console.log("[Dashboard Filters] Draft filters:", draftFilters);
      console.log("[Dashboard Filters] Applied filters:", scopedFilters);
    }
    setAppliedFilters(scopedFilters);
    saveStoredDashboardFilters(filterStorageKey, scopedFilters);
    loadDashboard(scopedFilters, true);
  };

  const clearFilters = () => {
    if (import.meta.env.DEV) console.log("[Dashboard Filters] Applied filters:", scopedDefaults);
    setDraftFilters(scopedDefaults);
    setAppliedFilters(scopedDefaults);
    saveStoredDashboardFilters(filterStorageKey, scopedDefaults);
    loadDashboard(scopedDefaults, true);
  };

  const refreshDashboard = async () => {
    if (currentUser?.role === "super_admin") await refreshAnalytics({ rebuild: true });
    await loadDashboard(appliedFilters, true);
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
    anchor.download = "crimepulse_summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportProfessionalReport = () => {
    if (!summary) return;
    const generatedAt = new Date().toLocaleString();
    const total = Math.max(summary.totalCrimes, 1);
    const riskLevel = (value: number, max: number) => {
      const score = Math.round((value / Math.max(max, 1)) * 100);
      if (score >= 80) return "High";
      if (score >= 45) return "Medium";
      return "Low";
    };
    const recommendations = [
      ["High", `Prioritize ${summary.mostReportedCrimeType} prevention`, `${summary.mostReportedCrimeType} is the dominant crime type in the selected view.`],
      ["High", "Review highest-volume district deployment", `${districtRanking[0]?.name || "The leading district"} has the highest record volume.`],
      [summary.totalConvictions < summary.totalAccused ? "Medium" : "Low", "Strengthen evidence and case follow-up", `The dataset records ${summary.totalAccused} accused persons and ${summary.totalConvictions} convictions.`],
      [summary.coordinateAvailablePercentage < 40 ? "Medium" : "Low", "Improve FIR location capture", `Coordinate availability is ${summary.coordinateAvailablePercentage}% in the selected records.`]
    ];
    downloadProfessionalWorkbook([
      {
        name: "Executive Summary",
        title: "CrimePulse AI Intelligence Summary",
        generatedAt,
        headers: ["Metric", "Value", "Insight"],
        rows: [
          ["Total Records", summary.totalCrimes, "Stored FIR/crime records included in this dashboard view."],
          ["Districts Covered", summary.totalDistricts, "Unique districts represented in the selected records."],
          ["Police Stations", summary.totalPoliceStations, "Unique police stations represented in the selected records."],
          ["Most Reported Crime Type", summary.mostReportedCrimeType, "Highest-frequency crime type in the selected view."],
          ["Heinous Crimes", summary.heinousCrimeCount, "High-severity/heinous crime records."],
          ["Non-Heinous Crimes", summary.nonHeinousCrimeCount, "Medium/other severity crime records."],
          ["Total Victims", summary.totalVictims, "Recorded victim count across selected records."],
          ["Total Accused", summary.totalAccused, "Recorded accused count across selected records."],
          ["Total Arrests", summary.totalArrests, "Recorded arrests across selected records."],
          ["Total Convictions", summary.totalConvictions, "Recorded convictions across selected records."],
          ["Coordinate Availability", `${summary.coordinateAvailablePercentage}%`, "Share of records with usable latitude and longitude."],
          ["Data Quality Score", `${globalStats?.data_quality_score ?? 0}%`, "Required-field and coordinate completeness indicator."]
        ]
      },
      {
        name: "Top Districts",
        title: "CrimePulse AI - Top Districts",
        generatedAt,
        headers: ["district", "crime_count", "risk_level", "top_crime_type"],
        rows: districtRanking.slice(0, 10).map((item) => [item.name, item.value, riskLevel(item.value, districtRanking[0]?.value || 1), summary.mostReportedCrimeType])
      },
      {
        name: "Top Police Stations",
        title: "CrimePulse AI - Top Police Stations",
        generatedAt,
        headers: ["police_station", "district", "crime_count", "top_crime_type"],
        rows: policeStationRanking.slice(0, 10).map((item) => [item.name, appliedFilters.district && appliedFilters.district !== "All" ? appliedFilters.district : "Selected dataset", item.value, summary.mostReportedCrimeType])
      },
      {
        name: "Crime Types",
        title: "CrimePulse AI - Crime Type Distribution",
        generatedAt,
        headers: ["crime_type", "count", "percentage"],
        rows: crimeTypes.slice(0, 20).map((item) => [item.name, item.value, `${Math.round((item.value / total) * 100)}%`])
      },
      {
        name: "Recommendations",
        title: "CrimePulse AI - Recommended Police Actions",
        generatedAt,
        headers: ["priority", "recommendation", "reason"],
        rows: recommendations
      }
    ]);
  };

  const totalCrimes = summary?.totalCrimes ?? storedRecordCount ?? 0;
  const filteredViewActive = dashboardMeta?.isFiltered ?? hasActiveFilters(appliedFilters);
  const uploadedRecordCount = dashboardMeta?.totalUploadedRecords ?? globalStats?.total_uploaded_records ?? globalStats?.total_records ?? storedRecordCount ?? 0;
  const recordsAnalyzed = dashboardMeta?.recordsAnalyzed ?? summary?.totalCrimes ?? uploadedRecordCount;
  const filterLabels = activeFilterEntries(dashboardMeta?.appliedFilters || appliedFilters).map(([, value]) => String(value));

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
          onClick={() => void refreshDashboard()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (totalCrimes === 0 && (storedRecordCount ?? uploadedRecordCount) === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Crime Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">{profile.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{profile.subtitle}</p>
          <p className={`mt-2 text-sm font-medium ${filteredViewActive ? "text-alert-medium" : "text-alert-low"}`}>
            {filteredViewActive ? "Filtered view active" : "Showing all records"}
          </p>
        </div>
        <NoDataState currentUser={currentUser} moduleName="Crime Command Dashboard" />
      </div>
    );
  }

  if (totalCrimes === 0 && filteredViewActive && (storedRecordCount ?? uploadedRecordCount) > 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Crime Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">{profile.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{profile.subtitle}</p>
        </div>
        <section className="rounded-md border border-alert-medium/40 bg-command-900/85 p-6 text-center shadow-glow">
          <h2 className="text-2xl font-semibold text-white">No records match the selected filters.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Showing 0 matching records from {uploadedRecordCount.toLocaleString()} uploaded records.
            {filterLabels.length > 0 ? ` Filters: ${filterLabels.join(" · ")}` : ""}
          </p>
          <button className="mt-5 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={clearFilters} type="button">
            Clear Filters
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Crime Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">{profile.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{profile.subtitle}</p>
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
        <div className="flex flex-wrap gap-2">
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800"
            onClick={exportSummaryCsv}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export Summary CSV
          </button>
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950"
            onClick={exportProfessionalReport}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export Professional Report
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">CSV exports raw data. Use Professional Report for formatted Excel-style output.</p>

      <CurrentAnalysisScopeBanner
        meta={dashboardMeta}
        filters={appliedFilters}
        recordsAnalyzed={recordsAnalyzed}
        districtCount={summary?.totalDistricts}
        policeStationCount={summary?.totalPoliceStations}
        coordinateCoverage={summary?.coordinateAvailablePercentage}
        dataQuality={globalStats?.data_quality_score}
        onClearFilters={filteredViewActive ? clearFilters : undefined}
      />

      <GuidedJourney canAccessRoute={canAccessRoute} />
      {canAccessRoute("/alerts-patterns") && <RecommendedNextStep title="Check Alerts & Pattern Detection" description="Use anomaly signals to focus attention on emerging or unusually concentrated crime patterns." to="/alerts-patterns" action="View Signals" />}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="text-base font-semibold text-white">Filters</h2>
          <div className="flex flex-wrap gap-2"><span className="rounded border border-command-500/40 bg-command-500/10 px-3 py-1 text-xs font-semibold text-command-300">{scopeLabel}</span><span className={`rounded border px-3 py-1 text-xs font-semibold ${filteredViewActive ? "border-alert-medium/40 bg-alert-medium/10 text-alert-medium" : "border-alert-low/40 bg-alert-low/10 text-alert-low"}`}>{filteredViewActive ? "Filtered view active" : "Showing all records"}</span></div>
        </div>
        <div className="mt-4 rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
          {filterLabels.length > 0 ? (
            <p className="text-safe">Active filters: <span className="font-semibold text-white">{filterLabels.join(" · ")}</span></p>
          ) : (
            <p className="text-safe">No optional filters selected. Dashboard is using the current role scope and uploaded dataset.</p>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="FIR Year" value={draftFilters.fir_year} options={filterOptions.years} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={draftFilters.fir_month} options={filterOptions.months} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="District" value={draftFilters.district} options={filterOptions.districts} onChange={(value) => updateFilter("district", value)} locked={districtLocked} />
          <SelectFilter label="Police Station" value={draftFilters.police_station} options={filterOptions.policeStations} onChange={(value) => updateFilter("police_station", value)} locked={stationLocked} />
          <SelectFilter label="Crime Group" value={draftFilters.crime_type} options={filterOptions.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="FIR Type / Severity" value={draftFilters.severity} options={filterOptions.severities} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={draftFilters.fir_stage} options={filterOptions.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
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

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h2 className="text-base font-semibold text-white">My View Preferences</h2><p className="mt-1 text-sm text-slate-400">Saved locally for {currentUser?.name || "this user"}.</p></div><span className="text-xs text-command-300">Default route: {currentUser?.defaultRoute || "/dashboard"}</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Default Landing<select className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none" value={currentUser?.defaultRoute || "/dashboard"} disabled><option>{currentUser?.defaultRoute || "/dashboard"}</option></select></label>
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Default Dataset<select className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none" value={preferences?.defaultDataset || "all"} onChange={(event) => updatePreferences({ defaultDataset: event.target.value })}><option value="all">All datasets</option></select></label>
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Report Format<select className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none" value={preferences?.reportFormat || "full-intelligence-report"} onChange={(event) => updatePreferences({ reportFormat: event.target.value })}><option value="full-intelligence-report">Full intelligence report</option><option value="district-report">District report</option><option value="station-report">Station report</option></select></label>
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Dashboard Density<select className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none" value={preferences?.themeDensity || "comfortable"} onChange={(event) => updatePreferences({ themeDensity: event.target.value as "compact" | "comfortable" })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
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

      <div className="stat-grid">
        <DashboardCard title={currentUser?.role === "station_officer" ? "Station Records" : currentUser?.role === "district_officer" ? "District Records" : "Total Reported Crimes"} value={summary?.totalCrimes ?? 0} icon={Database} />
        <DashboardCard title={currentUser?.role === "district_officer" ? "Police Stations in District" : "Districts Covered"} value={summary?.totalDistricts ?? 0} icon={Building2} tone="green" />
        <DashboardCard title={currentUser?.role === "station_officer" ? "Station Coverage" : "Police Stations"} value={summary?.totalPoliceStations ?? 0} icon={MapPinned} />
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
