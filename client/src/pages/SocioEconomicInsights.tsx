import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, RefreshCw, ShieldAlert, Target, TrendingUp, Users } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { socioEconomicService } from "../services/socioEconomicService";
import type {
  SocioEconomicComparisonRow,
  SocioEconomicCorrelationPoint,
  SocioEconomicFilterOptions,
  SocioEconomicFilters,
  SocioEconomicInsight,
  SocioEconomicOverview,
  SocioEconomicRecommendation,
  SocioEconomicRiskIndicators,
  SocioEconomicVulnerabilityItem
} from "../types/crime";

const emptyFilters: SocioEconomicFilters = { district: "All", police_station: "All", fir_year: "All", fir_month: "All", crime_type: "All", severity: "All", fir_stage: "All" };
const emptyOptions: SocioEconomicFilterOptions = { districts: [], policeStations: [], years: [], months: [], crimeTypes: [], severities: [], statuses: [] };

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

const optionList = (options: SocioEconomicFilterOptions, primary: keyof SocioEconomicFilterOptions, fallback?: keyof SocioEconomicFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const IndicatorCard = ({ title, indicator }: { title: string; indicator?: { score: number; level: "Low" | "Medium" | "High" | "Critical"; explanation: string; affected_districts: string[] } }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-command-300">Proxy Indicator</p>
        <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      </div>
      {indicator ? <span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[indicator.level]}`}>{indicator.level}</span> : null}
    </div>
    <p className="mt-4 text-4xl font-semibold text-white">{indicator?.score ?? 0}</p>
    <p className="mt-3 text-sm leading-6 text-slate-300">{indicator?.explanation || "No indicator data available."}</p>
    <p className="mt-3 text-xs text-slate-500">Affected: {(indicator?.affected_districts || []).join(", ") || "No data"}</p>
  </section>
);

const SocioEconomicInsights = () => {
  const [filters, setFilters] = useState<SocioEconomicFilters>(emptyFilters);
  const [options, setOptions] = useState<SocioEconomicFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<SocioEconomicOverview | null>(null);
  const [profiles, setProfiles] = useState<SocioEconomicComparisonRow[]>([]);
  const [indicators, setIndicators] = useState<SocioEconomicRiskIndicators | null>(null);
  const [correlations, setCorrelations] = useState<SocioEconomicCorrelationPoint[]>([]);
  const [vulnerability, setVulnerability] = useState<SocioEconomicVulnerabilityItem[]>([]);
  const [insights, setInsights] = useState<SocioEconomicInsight[]>([]);
  const [recommendations, setRecommendations] = useState<SocioEconomicRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadData = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [filtersRes, summaryRes, profileRes, indicatorRes, correlationRes, vulnerabilityRes, insightRes, recommendationRes] = await Promise.all([
        socioEconomicService.getFilters(),
        socioEconomicService.getSummary(nextFilters),
        socioEconomicService.getDistrictProfiles(nextFilters),
        socioEconomicService.getRiskIndicators(nextFilters),
        socioEconomicService.getCorrelation(nextFilters),
        socioEconomicService.getVulnerabilityIndex(nextFilters),
        socioEconomicService.getInsights(nextFilters),
        socioEconomicService.getRecommendations(nextFilters)
      ]);
      setOptions(filtersRes.data);
      setSummary(summaryRes.data);
      setProfiles(profileRes.data);
      setIndicators(indicatorRes.data);
      setCorrelations(correlationRes.data);
      setVulnerability(vulnerabilityRes.data);
      setInsights(insightRes.data.insights);
      setRecommendations(recommendationRes.data);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Socio-Economic Insights.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Socio-Economic Insights API failed.` : detail);
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

  const updateFilter = (key: keyof SocioEconomicFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <StateBlock title="Loading Socio-Economic Insights" message="Generating crime-derived proxy indicators from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Socio-economic module unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload crime CSV records first to generate socio-economic insights."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Socio-Economic API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">Retry Insights</button>
        </div>
      </div>
    );
  }
  if (!summary || profiles.length === 0) return <StateBlock title="No crime data available" message="Upload crime CSV records first to generate socio-economic insights." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Socio-Economic Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Crime-Derived Proxy Insights</h1>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadData(filters)} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh Insights
        </button>
      </div>

      <section className="rounded-md border border-command-300/50 bg-command-500/10 p-4 text-sm leading-6 text-command-300">
        These insights use crime-derived proxy indicators. External socio-economic datasets can be connected later for deeper correlation.
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardCard title="Records Analyzed" value={summary.total_records_analyzed || 0} icon={Database} />
        <DashboardCard title="Districts Analyzed" value={summary.total_districts || summary.districts_analyzed} icon={Users} />
        <DashboardCard title="Highest Vulnerability" value={summary.highest_vulnerability_district || "No data"} icon={ShieldAlert} tone="red" />
        <DashboardCard title="Public Safety Pressure" value={summary.highest_public_safety_pressure_district || "No data"} icon={TrendingUp} tone="orange" />
        <DashboardCard title="Resolution Gap" value={summary.highest_resolution_gap_district || "No data"} icon={Target} />
        <DashboardCard title="Avg Vulnerability Index" value={summary.average_vulnerability_index || 0} icon={Database} tone="green" />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadData(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Vulnerability Index Ranking</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vulnerability.slice(0, 12)}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="district" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Bar dataKey="vulnerability_index" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Proxy Correlation Panel</h2>
          <div className="mt-4 space-y-3">
            {correlations.map((item) => (
              <div key={`${item.factor}-${item.related_to}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{item.factor} to {item.related_to}</p>
                <p className="mt-2">{item.explanation}</p>
                <span className="mt-3 inline-block rounded border border-command-700 px-2 py-1 text-xs text-command-300">{item.relationship_strength}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <IndicatorCard title="Public Safety Pressure" indicator={indicators?.public_safety_pressure} />
        <IndicatorCard title="Vulnerability Pressure" indicator={indicators?.vulnerability_pressure} />
        <IndicatorCard title="Legal Resolution Gap" indicator={indicators?.legal_resolution_gap} />
        <IndicatorCard title="Administrative Load" indicator={indicators?.administrative_load} />
        <IndicatorCard title="Spatial Data Readiness" indicator={indicators?.spatial_data_readiness} />
        <IndicatorCard title="Community Safety Risk" indicator={indicators?.community_safety_risk} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">District Profile Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3">District</th><th className="px-3 py-3">Vulnerability</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Crimes</th><th className="px-3 py-3">Victims</th><th className="px-3 py-3">Heinous</th><th className="px-3 py-3">Arrest Rate</th><th className="px-3 py-3">Conviction Rate</th><th className="px-3 py-3">Pending</th><th className="px-3 py-3">Coordinates</th><th className="px-3 py-3">Dominant Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {profiles.slice(0, 50).map((row) => (
                <tr key={row.district} className="hover:bg-command-850/70">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-200">{row.district}</td>
                  <td className="px-3 py-3 font-semibold text-command-300">{row.vulnerability_index}</td>
                  <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[row.risk_level]}`}>{row.risk_level}</span></td>
                  <td className="px-3 py-3 text-slate-300">{row.total_crimes}</td>
                  <td className="px-3 py-3 text-slate-300">{row.total_victims}</td>
                  <td className="px-3 py-3 text-slate-300">{row.heinous_share}%</td>
                  <td className="px-3 py-3 text-slate-300">{row.arrest_rate}%</td>
                  <td className="px-3 py-3 text-slate-300">{row.conviction_rate}%</td>
                  <td className="px-3 py-3 text-slate-300">{row.pending_case_share}%</td>
                  <td className="px-3 py-3 text-slate-300">{row.coordinate_available_percentage}%</td>
                  <td className="min-w-56 px-3 py-3 text-slate-300">{row.complaint_mode_dominance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Insights</h2>
          <div className="mt-4 space-y-3">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{insight.title}</p>
                <p className="mt-2">{insight.description}</p>
                <p className="mt-2 text-command-300">{insight.recommendation || insight.recommended_actions?.[0]}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Recommendations</h2>
          <div className="mt-4 space-y-3">
            {recommendations.map((item) => (
              <div key={`${item.title}-${item.district}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{item.title}</p>
                  <span className="rounded border border-command-700 px-2 py-1 text-xs text-command-300">{item.priority}</span>
                </div>
                <p className="mt-2">{item.reason}</p>
                <p className="mt-2 text-command-300">{item.action}</p>
                <p className="mt-2 text-xs text-slate-500">{item.district} | {item.expected_impact}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SocioEconomicInsights;
