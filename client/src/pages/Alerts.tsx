import { useEffect, useState } from "react";
import { AlertOctagon, BellRing, Clock, Flame, MapPinned, RefreshCw, ShieldAlert, Siren } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DistributionPieChart, RankingBarChart } from "../components/ChartPanel";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { alertService } from "../services/alertService";
import { crimeService } from "../services/crimeService";
import type { AlertCharts, AlertFilterOptions, AlertFilters, AlertSummary, RedZoneAlert } from "../types/crime";

const emptyFilters: AlertFilters = { district: "All", police_station: "All", crime_type: "All", severity: "All", fir_stage: "All", alert_type: "All", fir_year: "All", fir_month: "All" };
const emptyOptions: AlertFilterOptions = { districts: [], policeStations: [], crimeTypes: [], severities: [], statuses: [], alertTypes: [], years: [], months: [] };
const emptyCharts: AlertCharts = { spikeComparison: [], districtAnomalyCounts: [], severityDistribution: [], monthlyAnomalyTrend: [], alertsByCrimeType: [] };

const severityClass = {
  Critical: "border-alert-critical/60 bg-alert-critical/10 text-alert-critical",
  High: "border-alert-high/60 bg-alert-high/10 text-alert-high",
  Medium: "border-alert-medium/60 bg-alert-medium/10 text-alert-medium",
  Low: "border-alert-low/60 bg-alert-low/10 text-alert-low"
};

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value || "All"}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="All">All</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

const AlertCard = ({ alert }: { alert: RedZoneAlert }) => (
  <article className={`rounded-md border bg-command-900/90 p-5 shadow-glow ${alert.severity === "Critical" ? "animate-pulse border-alert-critical" : "border-command-700"}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-white">{alert.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{alert.district}{alert.police_station ? ` / ${alert.police_station}` : ""}</p>
      </div>
      <span className={`rounded border px-2 py-1 text-xs font-semibold ${severityClass[alert.severity]}`}>{alert.severity}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Crime type: <span className="text-white">{alert.crime_type}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Increase: <span className="text-white">{alert.increase_percentage}%</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Current: <span className="text-white">{alert.current_value}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Expected: <span className="text-white">{alert.expected_value}</span></div>
    </div>
    <p className="mt-4 text-sm leading-6 text-slate-300">{alert.explanation}</p>
    <p className="mt-3 rounded border border-command-700 bg-command-850 p-3 text-sm text-command-300">{alert.recommended_action}</p>
  </article>
);

const SpikeComparisonChart = ({ data }: { data: AlertCharts["spikeComparison"] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">Crime Spike Comparison</h2>
    <div className="mt-4 h-72">
      {data.length === 0 ? <StateBlock title="No spike data" message="Spike comparison will appear after anomalies are detected." /> : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis allowDecimals={false} stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
            <Legend />
            <Bar dataKey="expected" fill="#83c5ff" radius={[4, 4, 0, 0]} />
            <Bar dataKey="current" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </section>
);

const MonthlyAnomalyChart = ({ data }: { data: AlertCharts["monthlyAnomalyTrend"] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">Monthly Anomaly Trend</h2>
    <div className="mt-4 h-72">
      {data.length === 0 ? <StateBlock title="No anomaly trend" message="Monthly trend will appear after alerts are detected." /> : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis allowDecimals={false} stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
            <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  </section>
);

const optionList = (options: AlertFilterOptions, primary: keyof AlertFilterOptions, fallback?: keyof AlertFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const Alerts = () => {
  const [filters, setFilters] = useState<AlertFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AlertFilters>(emptyFilters);
  const [options, setOptions] = useState<AlertFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [alerts, setAlerts] = useState<RedZoneAlert[]>([]);
  const [whispers, setWhispers] = useState<string[]>([]);
  const [charts, setCharts] = useState<AlertCharts>(emptyCharts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadAlerts = async (nextFilters: AlertFilters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [summaryRes, alertsRes, whispersRes, chartsRes] = await Promise.all([
        alertService.getSummary(nextFilters),
        alertService.getAnomalies(nextFilters),
        alertService.getPatternWhispers(nextFilters),
        alertService.getCharts(nextFilters)
      ]);
      setSummary(summaryRes.data);
      setAlerts(alertsRes.data);
      setWhispers(whispersRes.data);
      setCharts({ ...emptyCharts, ...chartsRes.data });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Red-Zone Alerts.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Red-Zone Alert API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    alertService.getFilters().then((response) => setOptions(response.data)).catch(() => setOptions(emptyOptions));
    loadAlerts(appliedFilters);
  }, []);

  const updateFilter = (key: keyof AlertFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <StateBlock title="Loading Red-Zone Alerts" message="Detecting crime spikes and anomaly signals from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Alert engine unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV records first to activate Red-Zone Alerts."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Alert API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button
            className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950"
            onClick={() => loadAlerts(appliedFilters)}
            type="button"
          >
            Retry Alerts
          </button>
        </div>
      </div>
    );
  }

  const hasAlerts = (summary?.totalActiveAlerts || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Red-Zone Pulse</p>
          <h1 className="text-3xl font-semibold text-white">Alerts and Anomaly Detection</h1>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadAlerts(appliedFilters)} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh Alerts
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Alert Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
          <SelectFilter label="Alert Type" value={filters.alert_type} options={optionList(options, "alertTypes", "alert_type")} onChange={(value) => updateFilter("alert_type", value)} />
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => { setAppliedFilters(filters); loadAlerts(filters); }} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); loadAlerts(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <DashboardCard title="Total Active Alerts" value={summary?.totalActiveAlerts || 0} icon={BellRing} />
        <DashboardCard title="Critical Alerts" value={summary?.criticalAlerts || 0} icon={Siren} tone="red" />
        <DashboardCard title="High Alerts" value={summary?.highAlerts || 0} icon={Flame} tone="orange" />
        <DashboardCard title="Medium Alerts" value={summary?.mediumAlerts || 0} icon={ShieldAlert} />
        <DashboardCard title="High-Risk Districts" value={summary?.highRiskDistricts || 0} icon={MapPinned} tone="orange" />
        <DashboardCard title="Most Common Alert Type" value={summary?.mostCommonAlertType || "No alerts"} icon={ShieldAlert} />
        <DashboardCard title="Latest Alert Time" value={summary?.latestAlertTime ? new Date(summary.latestAlertTime).toLocaleString() : "No alerts"} icon={Clock} tone="green" />
      </div>

      <section className="rounded-md border border-alert-critical/50 bg-command-900/85 p-5 shadow-glow">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-alert-critical" />
          <h2 className="text-base font-semibold text-white">Red-Zone Pulse Alert Panel</h2>
        </div>
        {!hasAlerts ? (
          <div className="mt-4">
            <StateBlock title="No major red-zone alerts detected" message="No major red-zone alerts detected for the selected filters." />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {alerts.slice(0, 12).map((alert) => <AlertCard key={alert.alert_id} alert={alert} />)}
          </div>
        )}
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Pattern Whisper Alerts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {whispers.length === 0 ? (
            <p className="text-sm text-slate-400">No major pattern whispers detected for the selected filters.</p>
          ) : whispers.map((whisper) => (
            <div key={whisper} className="flex gap-3 rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
              <AlertOctagon className="h-4 w-4 flex-none text-alert-high" />
              {whisper}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SpikeComparisonChart data={charts.spikeComparison} />
        <RankingBarChart title="District Anomaly Count" data={charts.districtAnomalyCounts} color="#ef4444" />
        <DistributionPieChart title="Alert Severity Distribution" data={charts.severityDistribution} />
        <RankingBarChart title="Alerts by Crime Type" data={charts.alertsByCrimeType || []} color="#f59e0b" />
        <MonthlyAnomalyChart data={charts.monthlyAnomalyTrend} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Anomaly Detection Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3">District</th>
                <th className="px-3 py-3">Crime Type</th>
                <th className="px-3 py-3">Anomaly Type</th>
                <th className="px-3 py-3">Current</th>
                <th className="px-3 py-3">Historical Avg</th>
                <th className="px-3 py-3">Increase</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Detected</th>
                <th className="px-3 py-3">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">No major red-zone alerts detected for the selected filters.</td>
                </tr>
              ) : alerts.map((alert) => (
                <tr key={alert.alert_id} className="hover:bg-command-850/70">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-200">{alert.district}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{alert.crime_type}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-command-300">{alert.alert_type}</td>
                  <td className="px-3 py-3 text-slate-300">{alert.current_value}</td>
                  <td className="px-3 py-3 text-slate-300">{alert.expected_value}</td>
                  <td className="px-3 py-3 text-slate-300">{alert.increase_percentage}%</td>
                  <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs font-semibold ${severityClass[alert.severity]}`}>{alert.severity}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{new Date(alert.detected_at).toLocaleString()}</td>
                  <td className="min-w-72 px-3 py-3 text-slate-300">{alert.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Alerts;
