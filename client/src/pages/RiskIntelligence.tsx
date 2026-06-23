import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Database, Radar, RefreshCw, ShieldAlert, Target, TrendingUp } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { riskService } from "../services/riskService";
import type {
  DashboardFilterOptions,
  DashboardFilters,
  RiskCrimeTypeRanking,
  RiskDistrictRanking,
  RiskFactor,
  RiskIntelligenceSummary,
  RiskInterventionPlan,
  RiskPoliceStationRanking,
  RiskPriorityZone
} from "../types/crime";

const emptyFilters: DashboardFilters = { fir_year: "All", fir_month: "All", district: "All", police_station: "All", crime_type: "All", severity: "All", fir_stage: "All" };
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

const optionList = (options: DashboardFilterOptions, key: keyof DashboardFilterOptions) => {
  const value = options[key];
  return Array.isArray(value) ? value : [];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const ScoreWeights = () => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">Risk Score Formula</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {[
        ["Crime Volume", "25%"],
        ["Heinous Crime", "20%"],
        ["Trend Growth", "15%"],
        ["Police Station Concentration", "15%"],
        ["Legal Resolution Gap", "10%"],
        ["FIR Stage Pending", "10%"],
        ["Data Confidence", "5%"]
      ].map(([name, weight]) => (
        <div key={name} className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
          <p className="font-semibold text-white">{name}</p>
          <p className="mt-1 text-command-300">{weight}</p>
        </div>
      ))}
    </div>
  </section>
);

const RiskBadge = ({ level }: { level: "Low" | "Medium" | "High" | "Critical" }) => (
  <span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[level]}`}>{level}</span>
);

const RiskIntelligence = () => {
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters);
  const [options, setOptions] = useState<DashboardFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<RiskIntelligenceSummary | null>(null);
  const [districts, setDistricts] = useState<RiskDistrictRanking[]>([]);
  const [stations, setStations] = useState<RiskPoliceStationRanking[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<RiskCrimeTypeRanking[]>([]);
  const [zones, setZones] = useState<RiskPriorityZone[]>([]);
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [plans, setPlans] = useState<RiskInterventionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadData = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [filtersRes, summaryRes, districtRes, stationRes, crimeTypeRes, zoneRes, factorRes, planRes] = await Promise.all([
        riskService.getRiskIntelligenceFilters(),
        riskService.getRiskIntelligenceSummary(nextFilters),
        riskService.getRiskDistricts(nextFilters),
        riskService.getRiskPoliceStations(nextFilters),
        riskService.getRiskCrimeTypes(nextFilters),
        riskService.getPriorityZones(nextFilters),
        riskService.getRiskFactors(nextFilters),
        riskService.getInterventionPlan(nextFilters)
      ]);
      setOptions(filtersRes.data);
      setSummary(summaryRes.data);
      setDistricts(districtRes.data);
      setStations(stationRes.data);
      setCrimeTypes(crimeTypeRes.data);
      setZones(zoneRes.data);
      setFactors(factorRes.data);
      setPlans(planRes.data);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Risk Intelligence.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Risk Intelligence API failed.` : detail);
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

  if (loading) return <StateBlock title="Loading Risk Intelligence" message="Scoring operational risk from Catalyst CrimeRecords." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock title="Risk Intelligence unavailable" message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV data first."} />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Risk Intelligence API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">Retry Risk Intelligence</button>
        </div>
      </div>
    );
  }
  if (!summary) return <StateBlock title="No crime data available" message="Upload CSV data first to activate Risk Intelligence." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Operational Risk Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Risk Intelligence</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">Operational risk scoring, priority zones, and intervention planning from stored crime records.</p>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadData(filters)} type="button">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="stat-grid">
        <DashboardCard title="Records Analyzed" value={summary.total_records_analyzed} icon={Database} />
        <DashboardCard title="Critical Zones" value={summary.critical_zones} icon={AlertTriangle} tone="red" />
        <DashboardCard title="High Risk Zones" value={summary.high_risk_zones} icon={ShieldAlert} tone="orange" />
        <DashboardCard title="Highest Risk District" value={summary.highest_risk_district} icon={Target} />
        <DashboardCard title="Highest Risk PS" value={summary.highest_risk_police_station} icon={Radar} />
        <DashboardCard title="Highest Risk Crime" value={summary.highest_risk_crime_type} icon={TrendingUp} />
        <DashboardCard title="Avg Risk Score" value={summary.average_risk_score} icon={Radar} tone="green" />
      </div>

      <ScoreWeights />

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses")} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadData(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Risk Factor Breakdown</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factors}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="factor_name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Bar dataKey="score" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Priority Zones</h2>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {zones.slice(0, 12).map((zone) => (
              <div key={zone.zone_id} className={`rounded border p-4 text-sm text-slate-300 ${zone.priority_level === "Critical" ? "animate-pulse border-alert-critical/60 bg-alert-critical/10" : "border-command-700 bg-command-850"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{zone.district} / {zone.police_station}</p>
                  <RiskBadge level={zone.priority_level} />
                </div>
                <p className="mt-2">{zone.reason}</p>
                <p className="mt-2 text-command-300">{zone.immediate_action}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">District Risk Ranking</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr><th className="px-3 py-3">District</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Crimes</th><th className="px-3 py-3">Heinous %</th><th className="px-3 py-3">Top Crime</th><th className="px-3 py-3">Top PS</th><th className="px-3 py-3">Trend</th><th className="px-3 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {districts.slice(0, 30).map((row) => (
                <tr key={row.district} className="hover:bg-command-850/70">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-200">{row.district}</td>
                  <td className="px-3 py-3 font-semibold text-command-300">{row.risk_score}</td>
                  <td className="px-3 py-3"><RiskBadge level={row.risk_level} /></td>
                  <td className="px-3 py-3 text-slate-300">{row.total_crimes}</td>
                  <td className="px-3 py-3 text-slate-300">{row.heinous_share}%</td>
                  <td className="px-3 py-3 text-slate-300">{row.top_crime_type}</td>
                  <td className="px-3 py-3 text-slate-300">{row.top_police_station}</td>
                  <td className="px-3 py-3 text-slate-300">{row.trend_direction}</td>
                  <td className="min-w-72 px-3 py-3 text-command-300">{row.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Police Station Risk Ranking</h2>
          <div className="mt-4 space-y-3">
            {stations.slice(0, 12).map((row) => (
              <div key={`${row.district}-${row.police_station}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{row.police_station}</p>
                  <RiskBadge level={row.risk_level} />
                </div>
                <p className="mt-2">{row.district} | {row.total_crimes} crimes | {row.crime_share_in_district}% district share</p>
                <p className="mt-2 text-command-300">{row.recommended_action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Crime Type Risk Ranking</h2>
          <div className="mt-4 space-y-3">
            {crimeTypes.slice(0, 12).map((row) => (
              <div key={row.crime_type} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{row.crime_type}</p>
                  <RiskBadge level={row.risk_level} />
                </div>
                <p className="mt-2">{row.total_crimes} records across {row.affected_districts} districts. Top district: {row.top_district}</p>
                <p className="mt-2 text-command-300">{row.recommended_action}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Intervention Plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={`${plan.title}-${plan.district}-${plan.police_station}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-white">{plan.title}</p>
                <span className="rounded border border-command-700 px-2 py-1 text-xs text-command-300">{plan.priority}</span>
              </div>
              <p className="mt-2">{plan.reason}</p>
              <p className="mt-2 text-command-300">{plan.action}</p>
              <p className="mt-2 text-xs text-slate-500">{plan.timeline} | {plan.expected_impact}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default RiskIntelligence;
