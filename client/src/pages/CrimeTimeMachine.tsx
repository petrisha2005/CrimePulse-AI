import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw, Sparkles, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { timeMachineService } from "../services/timeMachineService";
import type {
  TimeMachineChangeItem,
  TimeMachineCompare,
  TimeMachineFilterOptions,
  TimeMachineFilters,
  TimeMachineInsight,
  TimeMachineMonthlyItem,
  TimeMachineSummary,
  TimeMachineTimelineItem,
  TimeMachineYearlyItem,
  MovementPattern
} from "../types/crime";

const emptyOptions: TimeMachineFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: [],
  presets: []
};

const emptyFilters: TimeMachineFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All",
  preset: "All",
  from_year: "All",
  from_month: "All",
  to_year: "All",
  to_month: "All"
};

const speeds = {
  Slow: 2200,
  Normal: 1200,
  Fast: 550
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
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const optionList = (options: TimeMachineFilterOptions, primary: keyof TimeMachineFilterOptions, fallback?: keyof TimeMachineFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const ChangeTable = ({ title, data }: { title: string; data: TimeMachineChangeItem[] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    <div className="mt-4 overflow-hidden rounded border border-command-700">
      <table className="min-w-full divide-y divide-command-700 text-sm">
        <thead className="bg-command-850 text-xs uppercase text-slate-400">
          <tr><th className="px-3 py-3 text-left">Name</th><th className="px-3 py-3 text-right">Current</th><th className="px-3 py-3 text-right">Previous</th><th className="px-3 py-3 text-right">Change</th></tr>
        </thead>
        <tbody className="divide-y divide-command-700/70">
          {data.slice(0, 10).map((item) => (
            <tr key={item.name}>
              <td className="px-3 py-3 text-slate-200">{item.name}</td>
              <td className="px-3 py-3 text-right text-slate-300">{item.value}</td>
              <td className="px-3 py-3 text-right text-slate-300">{item.previous}</td>
              <td className={`px-3 py-3 text-right font-semibold ${item.change >= 0 ? "text-alert-critical" : "text-alert-low"}`}>{item.change}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const TimelineChart = ({ data }: { data: TimeMachineTimelineItem[] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">Crime Count Over Selected Timeline</h2>
    <div className="mt-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
);

const ChangeBarChart = ({ title, data, color }: { title: string; data: TimeMachineChangeItem[]; color: string }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    <div className="mt-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 10)}>
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
          <Bar dataKey="change" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>
);

const CrimeTimeMachine = () => {
  const [options, setOptions] = useState<TimeMachineFilterOptions>(emptyOptions);
  const [filters, setFilters] = useState<TimeMachineFilters>(emptyFilters);
  const [summary, setSummary] = useState<TimeMachineSummary | null>(null);
  const [timeline, setTimeline] = useState<TimeMachineTimelineItem[]>([]);
  const [yearly, setYearly] = useState<TimeMachineYearlyItem[]>([]);
  const [monthly, setMonthly] = useState<TimeMachineMonthlyItem[]>([]);
  const [compare, setCompare] = useState<TimeMachineCompare | null>(null);
  const [movement, setMovement] = useState<MovementPattern[]>([]);
  const [movementData, setMovementData] = useState<{
    rising_districts: TimeMachineChangeItem[];
    declining_districts: TimeMachineChangeItem[];
    rising_crime_types: TimeMachineChangeItem[];
    declining_crime_types: TimeMachineChangeItem[];
  }>({ rising_districts: [], declining_districts: [], rising_crime_types: [], declining_crime_types: [] });
  const [insights, setInsights] = useState<TimeMachineInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof speeds>("Normal");
  const [timelineIndex, setTimelineIndex] = useState(0);

  const selectedPeriod = timeline[timelineIndex];
  const fastestRisingDistrict = compare?.top_increasing_districts[0];
  const fastestRisingCrimeType = compare?.top_increasing_crime_types[0];
  const mostReducedDistrict = compare?.top_decreasing_districts[0];
  const highestSeverityPeriod = timeline.reduce<TimeMachineTimelineItem | null>((best, item) => item.heinous_count > (best?.heinous_count || 0) ? item : best, null);

  const timelineDistrictTrend = useMemo(() => timeline.map((item) => ({ period: item.period, district: item.top_district, crimes: item.total_crimes })), [timeline]);
  const crimeTypeTrend = useMemo(() => timeline.map((item) => ({ period: item.period, crime_type: item.top_crime_type, crimes: item.total_crimes })), [timeline]);
  const severityTrend = useMemo(() => timeline.map((item) => ({ period: item.period, heinous: item.heinous_count })), [timeline]);

  const loadData = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [summaryRes, timelineRes, yearlyRes, monthlyRes, compareRes, movementRes, insightsRes] = await Promise.all([
        timeMachineService.getSummary(nextFilters),
        timeMachineService.getTimeline(nextFilters),
        timeMachineService.getYearly(nextFilters),
        timeMachineService.getMonthly(nextFilters),
        timeMachineService.getCompare(nextFilters),
        timeMachineService.getMovement(nextFilters),
        timeMachineService.getInsights(nextFilters)
      ]);
      setSummary(summaryRes.data);
      setTimeline(timelineRes.data.timeline);
      setYearly(yearlyRes.data);
      setMonthly(monthlyRes.data);
      setCompare(compareRes.data);
      setMovement(movementRes.data.movement_patterns);
      setMovementData({
        rising_districts: movementRes.data.rising_districts || [],
        declining_districts: movementRes.data.declining_districts || [],
        rising_crime_types: movementRes.data.rising_crime_types || [],
        declining_crime_types: movementRes.data.declining_crime_types || []
      });
      setInsights(insightsRes.data.insights);
      setTimelineIndex(0);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Crime Time Machine.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Crime Time Machine API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    timeMachineService.getFilters().then((response) => setOptions(response.data)).catch(() => setOptions(emptyOptions));
    loadData();
  }, []);

  useEffect(() => {
    if (!isPlaying || timeline.length <= 1) return;
    const timer = window.setInterval(() => {
      setTimelineIndex((current) => (current + 1) % timeline.length);
    }, speeds[speed]);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, timeline.length]);

  const updateFilter = (key: keyof TimeMachineFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <StateBlock title="Loading Crime Time Machine" message="Aggregating time-based crime movement from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Crime Time Machine unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV records first to activate Crime Time Machine."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Time Machine API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">
            Retry Time Machine
          </button>
        </div>
      </div>
    );
  }
  if (timeline.length === 0 || !compare) return <StateBlock title="No crime data available" message="Upload CSV records first to activate Crime Time Machine." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Temporal Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Crime Time Machine</h1>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadData()} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh Timeline
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Timeline Control Panel</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
          <SelectFilter label="Speed" value={speed} options={Object.keys(speeds)} onChange={(value) => setSpeed(value as keyof typeof speeds)} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="From Year" value={filters.from_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("from_year", value)} />
          <SelectFilter label="From Month" value={filters.from_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("from_month", value)} />
          <SelectFilter label="To Year" value={filters.to_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("to_year", value)} />
          <SelectFilter label="To Month" value={filters.to_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("to_month", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {options.presets.map((preset) => (
            <button
              key={preset.value}
              className="rounded-md border border-command-700 bg-command-850 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-command-800"
              onClick={() => updateFilter("preset", preset.value)}
              title={preset.notice || (preset.configurable ? "Configurable preset: add exact dates in backend config." : "")}
              type="button"
            >
              {preset.label}{preset.configurable ? " (configurable)" : ""}{preset.notice ? ` - ${preset.notice}` : ""}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center">
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => setIsPlaying((value) => !value)} type="button">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input className="h-2 flex-1 accent-command-300" max={timeline.length - 1} min={0} onChange={(event) => setTimelineIndex(Number(event.target.value))} type="range" value={timelineIndex} />
          <span className="rounded border border-command-700 bg-command-850 px-3 py-2 text-sm text-slate-300">{selectedPeriod?.period}</span>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => loadData(filters)} type="button">Apply Time View</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadData(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Records" value={summary?.total_records || 0} icon={Timer} />
        <DashboardCard title="Year Range" value={summary?.year_range || "No data"} icon={Timer} />
        <DashboardCard title="Peak Period" value={summary ? `${summary.peak_year}-${String(summary.peak_month).padStart(2, "0")}` : "No data"} icon={TrendingUp} tone="orange" />
        <DashboardCard title="Trend Direction" value={summary?.trend_direction || "Stable"} icon={summary?.trend_direction === "Falling" ? TrendingDown : TrendingUp} tone={summary?.trend_direction === "Falling" ? "green" : "red"} />
        <DashboardCard title="Selected Period Crimes" value={compare.selected_total} icon={Timer} />
        <DashboardCard title="Previous Period Crimes" value={compare.previous_total} icon={Timer} tone="green" />
        <DashboardCard title="Percentage Change" value={`${compare.percentage_change}%`} icon={compare.percentage_change >= 0 ? TrendingUp : TrendingDown} tone={compare.percentage_change >= 0 ? "red" : "green"} />
        <DashboardCard title="Fastest Rising District" value={fastestRisingDistrict?.name || "No data"} icon={TrendingUp} tone="orange" />
        <DashboardCard title="Fastest Rising Crime Type" value={fastestRisingCrimeType?.name || "No data"} icon={Sparkles} />
        <DashboardCard title="Most Reduced District" value={mostReducedDistrict?.name || "No data"} icon={TrendingDown} tone="green" />
        <DashboardCard title="Highest Severity Period" value={highestSeverityPeriod?.period || "No data"} icon={Sparkles} tone="red" />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Time-Based District View</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {timeline.slice(Math.max(0, timelineIndex - 3), timelineIndex + 5).map((item) => (
            <div key={item.period} className={`rounded border p-4 ${item.period === selectedPeriod?.period ? "border-command-300 bg-command-800" : "border-command-700 bg-command-850"}`}>
              <p className="text-sm font-semibold text-white">{item.period}</p>
              <p className="mt-2 text-2xl font-semibold text-command-300">{item.total_crimes}</p>
              <p className="mt-1 text-xs text-slate-400">Top district: {item.top_district}</p>
              <p className="text-xs text-slate-400">Top crime: {item.top_crime_type}</p>
              <span className="mt-3 inline-block rounded border border-command-700 px-2 py-1 text-xs text-slate-300">{item.risk_level}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <TimelineChart data={timeline} />
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Year-Wise Crime Trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearly}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Bar dataKey="total_crimes" fill="#83c5ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Month-Wise Seasonality</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Bar dataKey="total_crimes" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <ChangeBarChart title="Top Increasing Districts" data={compare.top_increasing_districts} color="#ef4444" />
        <ChangeBarChart title="Top Decreasing Districts" data={compare.top_decreasing_districts} color="#22c55e" />
        <ChangeBarChart title="Crime Type Trend Changes" data={compare.top_increasing_crime_types} color="#f97316" />
        <ChangeBarChart title="Severity Trend Chart" data={compare.severity_change} color="#facc15" />
        <TimelineChart data={timelineDistrictTrend.map((item) => ({ period: item.period, total_crimes: item.crimes, heinous_count: 0, top_district: item.district, top_crime_type: "", risk_level: "Low" }))} />
        <TimelineChart data={crimeTypeTrend.map((item) => ({ period: item.period, total_crimes: item.crimes, heinous_count: 0, top_district: "", top_crime_type: item.crime_type, risk_level: "Low" }))} />
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Severity Trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={severityTrend}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Line type="monotone" dataKey="heinous" stroke="#ef4444" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChangeTable title="Rising Districts" data={movementData.rising_districts} />
        <ChangeTable title="Declining Districts" data={movementData.declining_districts} />
        <ChangeTable title="Rising Crime Types" data={movementData.rising_crime_types} />
        <ChangeTable title="Declining Crime Types" data={movementData.declining_crime_types} />
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Crime Movement Insights</h2>
          <div className="mt-4 space-y-3">
            {movement.map((pattern) => (
              <div key={`${pattern.from_area}-${pattern.to_area}-${pattern.crime_type}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <p className="font-semibold text-command-300">{pattern.pattern_type}</p>
                <p className="mt-2">{pattern.explanation}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Rule-Based Narrative Insights</h2>
          <div className="mt-4 space-y-3">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{insight.title}</p>
                  <span className="rounded border border-command-700 px-2 py-1 text-xs text-command-300">{insight.severity}</span>
                </div>
                <p className="mt-2">{insight.description}</p>
                <p className="mt-2 text-command-300">{insight.suggested_action}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CrimeTimeMachine;
