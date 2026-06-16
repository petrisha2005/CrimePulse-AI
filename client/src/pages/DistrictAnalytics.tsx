import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, MapPinned, RefreshCw, ShieldAlert, Target, TrendingUp, Users } from "lucide-react";
import { DistributionPieChart, RankingBarChart } from "../components/ChartPanel";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { dashboardService } from "../services/dashboardService";
import type {
  ChartDatum,
  DashboardFilterOptions,
  DashboardFilters,
  DistrictAnalyticsProfile,
  DistrictAnalyticsRanking,
  DistrictAnalyticsSummary,
  DistrictCrimeTypeItem,
  DistrictPoliceStationItem,
  DistrictTrendItem
} from "../types/crime";

const emptyFilters: DashboardFilters = { fir_year: "All", fir_month: "All", crime_type: "All", severity: "All", fir_stage: "All" };
const emptyOptions: DashboardFilterOptions = { years: [], months: [], districts: [], policeStations: [], crimeTypes: [], severities: [], statuses: [] };

const riskClass = {
  Low: "border-alert-low/50 bg-alert-low/10 text-alert-low",
  Medium: "border-alert-medium/50 bg-alert-medium/10 text-alert-medium",
  High: "border-alert-high/50 bg-alert-high/10 text-alert-high",
  Critical: "border-alert-critical/50 bg-alert-critical/10 text-alert-critical"
};

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={value || "All"} onChange={(event) => onChange(event.target.value)}>
      <option value="All">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const optionList = (options: DashboardFilterOptions, primary: keyof DashboardFilterOptions, fallback?: keyof DashboardFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const ProfileMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </div>
);

const DistrictAnalytics = () => {
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters);
  const [options, setOptions] = useState<DashboardFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<DistrictAnalyticsSummary | null>(null);
  const [ranking, setRanking] = useState<DistrictAnalyticsRanking[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [profile, setProfile] = useState<DistrictAnalyticsProfile | null>(null);
  const [trends, setTrends] = useState<DistrictTrendItem[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<DistrictCrimeTypeItem[]>([]);
  const [stations, setStations] = useState<DistrictPoliceStationItem[]>([]);
  const [firStages, setFirStages] = useState<ChartDatum[]>([]);
  const [complaintModes, setComplaintModes] = useState<ChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadDistrictDetails = async (district: string, nextFilters = filters) => {
    if (!district) return;
    const [profileRes, trendsRes, crimeTypeRes, stationRes, stageRes, modeRes] = await Promise.all([
      dashboardService.getDistrictAnalyticsProfile(district, nextFilters),
      dashboardService.getDistrictAnalyticsTrends(district, nextFilters),
      dashboardService.getDistrictAnalyticsCrimeTypes(district, nextFilters),
      dashboardService.getDistrictAnalyticsPoliceStations(district, nextFilters),
      dashboardService.getDistrictAnalyticsFirStages(district, nextFilters),
      dashboardService.getDistrictAnalyticsComplaintModes(district, nextFilters)
    ]);
    setProfile(profileRes.data);
    setTrends(trendsRes.data);
    setCrimeTypes(crimeTypeRes.data);
    setStations(stationRes.data);
    setFirStages(stageRes.data);
    setComplaintModes(modeRes.data);
  };

  const loadData = async (nextFilters = filters, preferredDistrict = selectedDistrict) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [filtersRes, summaryRes, rankingRes] = await Promise.all([
        dashboardService.getDistrictAnalyticsFilters(),
        dashboardService.getDistrictAnalyticsSummary(nextFilters),
        dashboardService.getDistrictAnalyticsRanking(nextFilters)
      ]);
      setOptions(filtersRes.data);
      setSummary(summaryRes.data);
      setRanking(rankingRes.data);
      const nextDistrict = preferredDistrict && rankingRes.data.some((item) => item.district === preferredDistrict)
        ? preferredDistrict
        : rankingRes.data[0]?.district || "";
      setSelectedDistrict(nextDistrict);
      if (nextDistrict) await loadDistrictDetails(nextDistrict, nextFilters);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load District Analytics.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but District Analytics API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    loadData();
  }, []);

  const updateFilter = (key: keyof DashboardFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const handleDistrictChange = async (district: string) => {
    setSelectedDistrict(district);
    setLoading(true);
    try {
      await loadDistrictDetails(district, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load selected district.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !summary) return <StateBlock title="Loading District Analytics" message="Aggregating district-level crime intelligence from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock title="District Analytics unavailable" message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV data first."} />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">District Analytics API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">Retry District Analytics</button>
        </div>
      </div>
    );
  }
  if (!summary || ranking.length === 0) return <StateBlock title="No crime data available" message="Upload CSV data first to activate District Analytics." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">District Command Analytics</p>
          <h1 className="text-3xl font-semibold text-white">District Analytics</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">Compare district-level crime performance, risk, police station concentration, and operational indicators.</p>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadData(filters)} type="button">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardCard title="Total Districts" value={summary.total_districts} icon={MapPinned} />
        <DashboardCard title="Total Records" value={summary.total_records} icon={Database} />
        <DashboardCard title="Highest Crime District" value={summary.highest_crime_district} icon={TrendingUp} tone="red" />
        <DashboardCard title="Highest Risk District" value={summary.highest_risk_district} icon={ShieldAlert} tone="orange" />
        <DashboardCard title="Avg Crimes / District" value={summary.average_crimes_per_district} icon={Users} />
        <DashboardCard title="Common Crime Type" value={summary.most_common_crime_type} icon={Target} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses")} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters, selectedDistrict)} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadData(emptyFilters); }} type="button">Clear Filters</button>
          <SelectFilter label="Select District" value={selectedDistrict} options={ranking.map((item) => item.district)} onChange={handleDistrictChange} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingBarChart title="District Ranking by Crime Count" data={ranking.slice(0, 12).map((item) => ({ name: item.district, value: item.total_crimes }))} />
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Selected District Monthly Trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Line type="monotone" dataKey="total_crimes" stroke="#83c5ff" strokeWidth={3} />
                <Line type="monotone" dataKey="heinous_count" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <DistributionPieChart title="Crime Type Distribution" data={crimeTypes.map((item) => ({ name: item.crime_type, value: item.count }))} />
        <RankingBarChart title="Police Station Contribution" data={stations.slice(0, 10).map((item) => ({ name: item.police_station, value: item.count }))} color="#f97316" />
        <DistributionPieChart title="FIR Stage Distribution" data={firStages} />
        <DistributionPieChart title="Complaint Mode Distribution" data={complaintModes} />
      </div>

      {profile && (
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-semibold text-white">{profile.district} District Profile</h2>
              <p className="mt-2 text-sm text-slate-400">{profile.operational_summary}</p>
            </div>
            <span className={`rounded border px-3 py-2 text-sm font-semibold ${riskClass[profile.risk_level]}`}>{profile.risk_level} / {profile.risk_score}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <ProfileMetric label="Total crimes" value={profile.total_crimes} />
            <ProfileMetric label="Police stations" value={profile.total_police_stations} />
            <ProfileMetric label="Top crime type" value={profile.top_crime_type} />
            <ProfileMetric label="Top subtype" value={profile.top_crime_subtype} />
            <ProfileMetric label="Heinous / Non" value={`${profile.heinous_count} / ${profile.non_heinous_count}`} />
            <ProfileMetric label="Victims" value={profile.victim_count} />
            <ProfileMetric label="Accused" value={profile.accused_count} />
            <ProfileMetric label="Arrested" value={profile.arrested_count} />
            <ProfileMetric label="Convictions" value={profile.conviction_count} />
            <ProfileMetric label="Arrest rate" value={`${profile.arrest_rate}%`} />
            <ProfileMetric label="Conviction rate" value={`${profile.conviction_rate}%`} />
            <ProfileMetric label="Coordinate %" value={`${profile.coordinate_available_percentage}%`} />
          </div>
        </section>
      )}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">District Ranking Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3">Rank</th><th className="px-3 py-3">District</th><th className="px-3 py-3">Total crimes</th><th className="px-3 py-3">Share %</th><th className="px-3 py-3">Risk score</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Top crime</th><th className="px-3 py-3">Top PS</th><th className="px-3 py-3">Heinous</th><th className="px-3 py-3">Convictions</th><th className="px-3 py-3">Coordinate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {ranking.map((row) => (
                <tr key={row.district} className="hover:bg-command-850/70">
                  <td className="px-3 py-3 text-slate-300">{row.rank}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-200">{row.district}</td>
                  <td className="px-3 py-3 text-slate-300">{row.total_crimes}</td>
                  <td className="px-3 py-3 text-slate-300">{row.crime_share_percentage}%</td>
                  <td className="px-3 py-3 font-semibold text-command-300">{row.risk_score}</td>
                  <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[row.risk_level]}`}>{row.risk_level}</span></td>
                  <td className="px-3 py-3 text-slate-300">{row.top_crime_type}</td>
                  <td className="px-3 py-3 text-slate-300">{row.top_police_station}</td>
                  <td className="px-3 py-3 text-slate-300">{row.heinous_count}</td>
                  <td className="px-3 py-3 text-slate-300">{row.conviction_count}</td>
                  <td className="px-3 py-3 text-slate-300">{row.coordinate_available_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {profile && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Key Observations</h2>
            <div className="mt-4 space-y-3">
              {profile.key_observations.map((item) => <div key={item} className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">{item}</div>)}
            </div>
          </section>
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Recommended Actions</h2>
            <div className="mt-4 space-y-3">
              {profile.recommended_actions.map((item) => <div key={item} className="rounded border border-command-700 bg-command-850 p-3 text-sm text-command-300">{item}</div>)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DistrictAnalytics;
