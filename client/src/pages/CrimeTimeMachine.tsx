import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Info, Pause, Play, RefreshCw, SkipBack, SkipForward, Sparkles, TrendingUp } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { timeMachineService } from "../services/timeMachineService";
import type { TimeMachineChangeItem, TimeMachineCompare, TimeMachineFilterOptions, TimeMachineFilters, TimeMachineInsight, TimeMachineMonthlyItem, TimeMachinePeriodDetails, TimeMachineSummary, TimeMachineTimelineItem, TimeMachineYearlyItem } from "../types/crime";

const emptyOptions: TimeMachineFilterOptions = { years: [], months: [], districts: [], policeStations: [], crimeTypes: [], severities: [], statuses: [], presets: [] };
const allFilters: TimeMachineFilters = { fir_year: "All", fir_month: "All", district: "All", police_station: "All", crime_type: "All", severity: "All", fir_stage: "All", from_year: "All", from_month: "All", to_year: "All", to_month: "All" };
const playbackSpeeds = { Slow: 2200, Normal: 1200, Fast: 550 };
const severityColors = ["#ef4444", "#f97316", "#00d4ff"];

const tooltipStyle = { background: "#0a1728", border: "1px solid #1e3a55", borderRadius: "4px" };
const activeFilter = (value: unknown) => value && String(value).toLowerCase() !== "all";

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={value || "All"} onChange={(event) => onChange(event.target.value)}>
      <option value="All">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const ChangeList = ({ title, data, rising }: { title: string; data: TimeMachineChangeItem[]; rising: boolean }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    {data.length === 0 ? <p className="mt-4 text-sm text-slate-400">No comparable movement is available for this selected timeline.</p> : (
      <div className="mt-4 space-y-2">
        {data.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 border-b border-command-700/70 pb-2 text-sm last:border-0">
            <span className="truncate text-slate-200">{item.name}</span>
            <span className={rising ? "font-semibold text-alert-high" : "font-semibold text-alert-low"}>{item.change > 0 ? "+" : ""}{item.change}%</span>
          </div>
        ))}
      </div>
    )}
  </section>
);

const ModeButton = ({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) => (
  <button className={`min-h-10 border px-3 text-sm font-semibold transition-colors ${active ? "border-command-300 bg-command-500 text-command-950" : "border-command-700 bg-command-850 text-slate-300 hover:bg-command-800"}`} onClick={onClick} type="button">{children}</button>
);

const CrimeTimeMachine = () => {
  const [filters, setFilters] = useState<TimeMachineFilters>(allFilters);
  const [options, setOptions] = useState<TimeMachineFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<TimeMachineSummary | null>(null);
  const [timeline, setTimeline] = useState<TimeMachineTimelineItem[]>([]);
  const [yearly, setYearly] = useState<TimeMachineYearlyItem[]>([]);
  const [monthly, setMonthly] = useState<TimeMachineMonthlyItem[]>([]);
  const [compare, setCompare] = useState<TimeMachineCompare | null>(null);
  const [movement, setMovement] = useState<{ rising_districts: TimeMachineChangeItem[]; falling_districts: TimeMachineChangeItem[]; rising_crime_types: TimeMachineChangeItem[]; falling_crime_types: TimeMachineChangeItem[]; rising_police_stations: TimeMachineChangeItem[]; falling_police_stations: TimeMachineChangeItem[] }>({ rising_districts: [], falling_districts: [], rising_crime_types: [], falling_crime_types: [], rising_police_stations: [], falling_police_stations: [] });
  const [insights, setInsights] = useState<TimeMachineInsight[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<keyof typeof playbackSpeeds>("Normal");
  const [playbackGranularity, setPlaybackGranularity] = useState<"Monthly" | "Yearly">("Monthly");
  const [viewMode, setViewMode] = useState<"timeline" | "compare" | "movement">("timeline");
  const [periodDetails, setPeriodDetails] = useState<TimeMachinePeriodDetails | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState(0);
  const [endpointStatus, setEndpointStatus] = useState<Record<string, boolean>>({});
  const [appliedFilters, setAppliedFilters] = useState<TimeMachineFilters>(allFilters);
  const [applyMessage, setApplyMessage] = useState("");

  const playbackSeries = useMemo<TimeMachineTimelineItem[]>(() => playbackGranularity === "Monthly" ? timeline : yearly.map((item) => ({ ...item, period: item.year, month: "", risk_level: "Low" })), [playbackGranularity, timeline, yearly]);
  const selectedPeriod = playbackSeries[selectedIndex];
  const activeFilterEntries = Object.entries(appliedFilters).filter(([, value]) => activeFilter(value));
  const activeQuery = new URLSearchParams(activeFilterEntries.map(([key, value]) => [key, String(value)])).toString();
  const oneDistrict = useMemo(() => new Set(timeline.map((item) => item.top_district).filter((value) => value && value !== "No data")).size <= 1, [timeline]);
  const activeDetails = periodDetails && periodDetails.period === selectedPeriod?.period ? periodDetails : null;

  const loadData = async (nextFilters: TimeMachineFilters = filters, showFeedback = false) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      if (showFeedback) setApplyMessage("Applying time view...");
      const countResponse = await crimeService.getCrimeCount();
      const count = countResponse.totalRecords ?? countResponse.data?.totalRecords ?? 0;
      setStoredCount(count);
      const results = await Promise.allSettled([
        timeMachineService.getFilters(), timeMachineService.getSummary(nextFilters), timeMachineService.getTimeline(nextFilters), timeMachineService.getYearly(nextFilters), timeMachineService.getMonthly(nextFilters), timeMachineService.getCompare(nextFilters), timeMachineService.getMovement(nextFilters), timeMachineService.getInsights(nextFilters)
      ]);
      const [filtersRes, summaryRes, timelineRes, yearlyRes, monthlyRes, compareRes, movementRes, insightsRes] = results;
      const value = <T,>(result: PromiseSettledResult<T>, fallback: T): T => result.status === "fulfilled" ? result.value : fallback;
      setEndpointStatus({ filters: filtersRes.status === "fulfilled", summary: summaryRes.status === "fulfilled", timeline: timelineRes.status === "fulfilled", yearly: yearlyRes.status === "fulfilled", monthly: monthlyRes.status === "fulfilled", compare: compareRes.status === "fulfilled", movement: movementRes.status === "fulfilled", insights: insightsRes.status === "fulfilled" });
      setOptions(value(filtersRes, emptyOptions));
      setSummary(value<TimeMachineSummary | null>(summaryRes, null));
      setTimeline(value<TimeMachineTimelineItem[]>(timelineRes, []));
      setYearly(value<TimeMachineYearlyItem[]>(yearlyRes, []));
      setMonthly(value<TimeMachineMonthlyItem[]>(monthlyRes, []));
      setCompare(value<TimeMachineCompare | null>(compareRes, null));
      const movementValue = value(movementRes, { movement_patterns: [], rising_districts: [], falling_districts: [], rising_crime_types: [], falling_crime_types: [], rising_police_stations: [], falling_police_stations: [] });
      setMovement({ rising_districts: movementValue.rising_districts || [], falling_districts: movementValue.falling_districts || [], rising_crime_types: movementValue.rising_crime_types || [], falling_crime_types: movementValue.falling_crime_types || [], rising_police_stations: movementValue.rising_police_stations || [], falling_police_stations: movementValue.falling_police_stations || [] });
      setInsights(value<TimeMachineInsight[]>(insightsRes, []));
      const failedEndpoint = results.find((result) => result.status === "rejected");
      if (failedEndpoint?.status === "rejected") setErrorDetail(failedEndpoint.reason instanceof Error ? failedEndpoint.reason.message : "One or more time analytics endpoints are unavailable.");
      setAppliedFilters(nextFilters);
      setSelectedIndex(0);
      setPeriodDetails(null);
      if (showFeedback) setApplyMessage(Object.values(nextFilters).some(activeFilter) ? "Filtered time view active" : "Showing all records");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Crime Time Machine.";
      setErrorDetail(detail);
      try {
        const countResponse = await crimeService.getCrimeCount();
        const count = countResponse.totalRecords ?? countResponse.data?.totalRecords ?? 0;
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Crime Time Machine API failed.` : detail);
      } catch { setError(detail); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(allFilters); }, []);
  useEffect(() => {
    if (!isPlaying || playbackSeries.length < 2) return;
    const timer = window.setInterval(() => setSelectedIndex((current) => current >= playbackSeries.length - 1 ? 0 : current + 1), playbackSpeeds[playbackSpeed]);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, playbackSeries.length]);
  useEffect(() => {
    if (!selectedPeriod) return;
    let active = true;
    setPeriodLoading(true);
    timeMachineService.getPeriod(selectedPeriod.period, appliedFilters)
      .then((data) => { if (active) setPeriodDetails(data); })
      .catch((err) => { if (active) setErrorDetail(err instanceof Error ? err.message : "Selected period details failed to load."); })
      .finally(() => { if (active) setPeriodLoading(false); });
    return () => { active = false; };
  }, [selectedPeriod?.period, activeQuery]);

  const updateFilter = (key: keyof TimeMachineFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const trendTone = compare?.trend === "Reduced" ? "green" : compare?.trend === "Increased" ? "red" : "blue";
  const changeText = activeDetails ? `${activeDetails.percentage_change > 0 ? "+" : ""}${activeDetails.percentage_change}%` : "--";

  if (loading && !summary) return <StateBlock title="Loading Crime Time Machine" message="Reading time-based change from uploaded Catalyst CrimeRecords." />;
  if (error) return <div className="space-y-4"><StateBlock title="Records found, but Crime Time Machine API failed." message={error} /><div className="rounded-md border border-alert-high/40 bg-command-900 p-4 text-sm text-alert-high">{errorDetail}<button className="ml-3 underline" onClick={() => void loadData(filters)} type="button">Retry</button></div></div>;
  if (!summary || timeline.length === 0 || !compare) return <StateBlock title="No time-based records available" message="Timeline is based on uploaded FIR records. Upload records with FIR year and month to activate this view." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-sm uppercase tracking-[0.18em] text-command-300">Temporal Intelligence</p><h1 className="text-3xl font-semibold text-white">Crime Time Machine</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Press play to watch crime activity move through the uploaded FIR timeline, one period at a time.</p></div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => void loadData(filters)} type="button"><RefreshCw className="h-4 w-4" />Refresh Timeline</button>
      </div>

      <section className="border border-command-700 bg-command-900/85 p-4 shadow-glow">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-command-300">Playback Mode</p><p className="mt-1 text-sm text-slate-400">Choose a way to read the same live, filtered timeline.</p></div><div className="flex flex-wrap gap-2"><ModeButton active={viewMode === "timeline"} onClick={() => setViewMode("timeline")}>Timeline View</ModeButton><ModeButton active={viewMode === "compare"} onClick={() => setViewMode("compare")}>Compare Periods</ModeButton><ModeButton active={viewMode === "movement"} onClick={() => setViewMode("movement")}>Movement Analysis</ModeButton></div></div>
      </section>

      <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 text-command-300" /><div><h2 className="font-semibold text-white">Filter the timeline</h2><p className="mt-1 text-sm text-slate-300">Playback rebuilds from the selected records only. Filters apply when you choose Apply Time View.</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-7"><SelectFilter label="FIR Year" value={filters.fir_year} options={options.years} onChange={(value) => updateFilter("fir_year", value)} /><SelectFilter label="FIR Month" value={filters.fir_month} options={options.months} onChange={(value) => updateFilter("fir_month", value)} /><SelectFilter label="District" value={filters.district} options={options.districts} onChange={(value) => updateFilter("district", value)} /><SelectFilter label="Police Station" value={filters.police_station} options={options.policeStations} onChange={(value) => updateFilter("police_station", value)} /><SelectFilter label="Crime Type" value={filters.crime_type} options={options.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} /><SelectFilter label="Severity" value={filters.severity} options={options.severities} onChange={(value) => updateFilter("severity", value)} /><SelectFilter label="FIR Stage" value={filters.fir_stage} options={options.statuses} onChange={(value) => updateFilter("fir_stage", value)} /></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SelectFilter label="Compare From Year" value={filters.from_year} options={options.years} onChange={(value) => updateFilter("from_year", value)} /><SelectFilter label="Compare From Month" value={filters.from_month} options={options.months} onChange={(value) => updateFilter("from_month", value)} /><SelectFilter label="Compare To Year" value={filters.to_year} options={options.years} onChange={(value) => updateFilter("to_year", value)} /><SelectFilter label="Compare To Month" value={filters.to_month} options={options.months} onChange={(value) => updateFilter("to_month", value)} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button className="flex min-h-11 items-center gap-2 bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:opacity-60" disabled={loading} onClick={() => void loadData(filters, true)} type="button">{loading ? <><RefreshCw className="h-4 w-4 animate-spin" />Applying...</> : "Apply Time View"}</button><button className="min-h-11 border border-command-700 px-4 py-3 text-sm text-slate-300 hover:bg-command-850" disabled={loading} onClick={() => { setFilters(allFilters); void loadData(allFilters, true); }} type="button">Clear Filters</button>{applyMessage && <span className="text-sm text-command-300">{applyMessage}</span>}</div>
      </section>

      <section className="border border-command-700 bg-command-900/85 p-4 text-sm shadow-glow"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">{activeFilterEntries.length ? "Filtered time view active" : "Showing all records"}</span>{activeFilterEntries.map(([key, value]) => <span key={key} className="border border-command-500/50 bg-command-500/10 px-2 py-1 text-command-300">{key.replace(/_/g, " ")}: {value}</span>)}</div><p className="mt-2 text-xs text-slate-500">Active query: {activeQuery || "none"} | Stored records: {storedCount.toLocaleString()} | Timeline records: {summary.total_records.toLocaleString()}</p></section>

      <section className="border border-command-500/50 bg-command-950/90 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-xs uppercase tracking-[0.16em] text-command-300">Selected Period</p><h2 className="mt-1 text-3xl font-semibold text-white">{selectedPeriod.period}</h2><p className="mt-2 text-sm text-slate-400">{periodLoading ? "Updating period intelligence..." : activeDetails?.insight || "Select a timeline point to inspect its crime pattern."}</p></div><div className="flex flex-wrap items-center gap-2"><button aria-label="Jump to first period" className="grid h-10 w-10 place-items-center border border-command-700 bg-command-850 text-slate-200 hover:bg-command-800" onClick={() => setSelectedIndex(0)} type="button"><SkipBack className="h-4 w-4" /></button><button className="flex min-h-10 items-center gap-2 border border-command-300 bg-command-500 px-3 text-sm font-semibold text-command-950 hover:bg-command-300" onClick={() => setIsPlaying((value) => !value)} type="button">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{isPlaying ? "Pause" : "Play Timeline"}</button><label className="flex min-h-10 items-center gap-2 border border-command-700 bg-command-850 px-3 text-sm text-slate-300">Period<select className="bg-transparent text-white outline-none" value={playbackGranularity} onChange={(event) => { setIsPlaying(false); setSelectedIndex(0); setPlaybackGranularity(event.target.value as "Monthly" | "Yearly"); }}><option className="bg-command-850" value="Monthly">Monthly</option><option className="bg-command-850" value="Yearly">Yearly</option></select></label><label className="flex min-h-10 items-center gap-2 border border-command-700 bg-command-850 px-3 text-sm text-slate-300">Speed<select className="bg-transparent text-white outline-none" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(event.target.value as keyof typeof playbackSpeeds)}>{Object.keys(playbackSpeeds).map((speed) => <option className="bg-command-850" key={speed} value={speed}>{speed}</option>)}</select></label><button aria-label="Jump to last period" className="grid h-10 w-10 place-items-center border border-command-700 bg-command-850 text-slate-200 hover:bg-command-800" onClick={() => setSelectedIndex(playbackSeries.length - 1)} type="button"><SkipForward className="h-4 w-4" /></button></div></div>
        <input aria-label="Timeline period" className="mt-6 h-2 w-full accent-command-300" min={0} max={playbackSeries.length - 1} value={selectedIndex} onChange={(event) => { setIsPlaying(false); setSelectedIndex(Number(event.target.value)); }} type="range" />
        <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{playbackSeries[0]?.period}</span><span>{selectedIndex + 1} of {playbackSeries.length} periods</span><span>{playbackSeries[playbackSeries.length - 1]?.period}</span></div>
      </section>

      {viewMode === "timeline" && <>
        <div className="stat-grid"><DashboardCard title="Selected Period Crimes" value={activeDetails?.total_crimes ?? selectedPeriod.total_crimes} icon={CalendarClock} /><DashboardCard title="Previous Period Crimes" value={activeDetails?.previous_total ?? "--"} icon={ArrowDownRight} tone="green" /><DashboardCard title="Change vs Previous" value={changeText} icon={activeDetails?.trend_direction === "Decreasing" ? ArrowDownRight : ArrowUpRight} tone={activeDetails?.trend_direction === "Decreasing" ? "green" : "red"} /><DashboardCard title="Peak Period" value={summary.peak_period || "No data"} icon={TrendingUp} tone="orange" /><DashboardCard title="Fastest Rising Crime" value={summary.fastest_rising_crime_type || "No data"} icon={Sparkles} tone="red" /><DashboardCard title="Most Active District" value={activeDetails?.top_district || "Loading"} icon={TrendingUp} /><DashboardCard title="Dominant Crime Type" value={activeDetails?.top_crime_type || "Loading"} icon={Info} /><DashboardCard title="Heinous Incidents" value={activeDetails?.heinous_count ?? "--"} icon={ArrowUpRight} tone="red" /><DashboardCard title="Trend Direction" value={activeDetails?.trend_direction || summary.trend_direction} icon={TrendingUp} tone="orange" /></div>

        <div className="grid gap-6 xl:grid-cols-2"><section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Crime Playback Timeline</h2><span className="text-xs text-command-300">Active: {selectedPeriod.period}</span></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={playbackSeries}><CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" /><XAxis dataKey="period" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Legend /><ReferenceLine x={selectedPeriod.period} stroke="#ffffff" strokeDasharray="4 4" label={{ value: "Active", fill: "#ffffff", fontSize: 11 }} /><Line isAnimationActive type="monotone" dataKey="total_crimes" name="Total crimes" stroke="#00d4ff" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 7, fill: "#ffffff" }} /><Line isAnimationActive type="monotone" dataKey="heinous_count" name="Heinous" stroke="#ef4444" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section>
          <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Crime Type Breakdown: {selectedPeriod.period}</h2><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={activeDetails?.top_crime_types || []} layout="vertical" margin={{ left: 24 }}><CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} stroke="#94a3b8" /><YAxis dataKey="name" type="category" width={110} tick={{ fill: "#cbd5e1", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar isAnimationActive dataKey="value" name="Cases" fill="#00d4ff" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></section>
          <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">District Activity: {selectedPeriod.period}</h2><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={activeDetails?.districts || []} layout="vertical" margin={{ left: 24 }}><CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} stroke="#94a3b8" /><YAxis dataKey="name" type="category" width={110} tick={{ fill: "#cbd5e1", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar isAnimationActive dataKey="value" name="Cases" radius={[0, 3, 3, 0]}>{(activeDetails?.districts || []).map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={index === 0 ? "#f97316" : "#4f9bd8"} />)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Severity Distribution</h2><div className="mt-4 grid items-center gap-2 sm:grid-cols-[1fr_auto]"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={activeDetails?.severity_distribution || []} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>{(activeDetails?.severity_distribution || []).map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={severityColors[index % severityColors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div><div className="space-y-2 text-sm">{(activeDetails?.severity_distribution || []).map((item, index) => <p key={item.name} className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: severityColors[index % severityColors.length] }} />{item.name}: <strong className="text-white">{item.value}</strong></p>)}</div></div></section></div>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><div className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Police Station Focus</h2><p className="mt-1 text-sm text-slate-400">Highest recorded station activity for {selectedPeriod.period}.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{(activeDetails?.police_stations || []).slice(0, 6).map((item, index) => <div key={item.name} className="flex items-center justify-between border border-command-700 bg-command-850 px-3 py-3"><span className="truncate text-sm text-slate-200"><span className="mr-2 text-command-300">{index + 1}</span>{item.name}</span><strong className="text-white">{item.value}</strong></div>)}{!activeDetails?.police_stations.length && <p className="text-sm text-slate-400">Loading station activity...</p>}</div></div><div className="border border-command-500/40 bg-command-500/10 p-5 shadow-glow"><h2 className="font-semibold text-white">Spatial Playback</h2><p className="mt-3 text-sm text-slate-300">{activeDetails?.coordinate_mode === "District-level fallback" ? "Exact coordinates are unavailable for this period. District-level activity is being used for map and hotspot context." : "Period-specific coordinate coverage can be used by the Hotspot Map for spatial playback."}</p><p className="mt-4 text-xs text-command-300">Coordinate mode: {activeDetails?.coordinate_mode || "Loading"}</p><Link className="mt-4 inline-flex min-h-10 items-center border border-command-300 px-3 text-sm font-semibold text-command-300 hover:bg-command-500/15" to={`/crime-trend-hotspot?fir_year=${encodeURIComponent(selectedPeriod.year || "")}&fir_month=${encodeURIComponent(selectedPeriod.month || "")}`}>Open period hotspot map</Link></div></section>
      </>}

      {viewMode === "compare" && <div className="grid gap-6 xl:grid-cols-2"><section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Earliest vs Latest Comparison</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="border border-command-700 bg-command-850 p-4"><p className="text-xs uppercase text-slate-500">From {compare.from_period}</p><p className="mt-2 text-3xl font-semibold text-white">{compare.from_total}</p></div><div className="border border-command-700 bg-command-850 p-4"><p className="text-xs uppercase text-slate-500">To {compare.to_period}</p><p className="mt-2 text-3xl font-semibold text-white">{compare.to_total}</p></div></div><p className="mt-4 text-sm text-slate-300">{compare.explanation || compare.insight}</p><p className={compare.trend === "Reduced" ? "mt-3 font-semibold text-alert-low" : "mt-3 font-semibold text-alert-high"}>{compare.trend}: {compare.difference && compare.difference > 0 ? "+" : ""}{compare.difference} records ({compare.percentage_change}%)</p></section><section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Year-Wise Crime Trend</h2><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearly}><CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" /><XAxis dataKey="year" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="total_crimes" fill="#00d4ff" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Month-Wise Seasonality</h2><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" /><XAxis dataKey="month_name" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="total_crimes" fill="#f97316" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section><ChangeList title="Most Changed Crime Types" data={compare.changed_crime_types || []} rising /></div>}

      {viewMode === "movement" && <><div className="grid gap-4 xl:grid-cols-3"><ChangeList title="Rising Crime Types" data={movement.rising_crime_types} rising /><ChangeList title="Falling Crime Types" data={movement.falling_crime_types} rising={false} /><ChangeList title="Rising Police Stations" data={movement.rising_police_stations} rising /></div>{oneDistrict ? <div className="border border-command-500/40 bg-command-500/10 p-4 text-sm text-command-300">Only one district is available in this filtered timeline, so district movement is limited.</div> : <section className="grid gap-4 xl:grid-cols-2"><ChangeList title="Rising Districts" data={movement.rising_districts} rising /><ChangeList title="Falling Districts" data={movement.falling_districts} rising={false} /></section>}</>}

      <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Timeline Insights</h2><div className="mt-4 grid gap-4 lg:grid-cols-3">{insights.map((insight) => <article key={insight.title} className="border border-command-700 bg-command-850 p-4"><h3 className="font-semibold text-white">{insight.title}</h3><p className="mt-2 text-sm text-slate-300">{insight.description}</p><p className="mt-3 text-sm text-command-300">{insight.suggested_action}</p></article>)}{insights.length === 0 && <p className="text-sm text-slate-400">No additional timeline insights are available for the selected filters.</p>}</div></section>

      <section className="grid gap-2 border border-command-700 bg-command-900/85 p-4 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(endpointStatus).map(([endpoint, loaded]) => <span key={endpoint}><span className="text-slate-500">{endpoint}:</span> <span className={loaded ? "text-alert-low" : "text-alert-high"}>{loaded ? "loaded" : "unavailable"}</span></span>)}{errorDetail && <span className="break-words text-alert-high sm:col-span-2 xl:col-span-4">Partial-data note: {errorDetail}</span>}</section>
    </div>
  );
};

export default CrimeTimeMachine;
