import { useEffect, useState } from "react";
import { BrainCircuit, Eye, Filter, RefreshCw, ShieldAlert, Siren, Target, X } from "lucide-react";
import { DistributionPieChart, RankingBarChart } from "../components/ChartPanel";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { patternService } from "../services/patternService";
import type { CrimePattern, PatternCharts, PatternFilterOptions, PatternFilters, PatternSummary } from "../types/crime";

const emptyFilters: PatternFilters = { district: "All", police_station: "All", crime_type: "All", pattern_type: "All", severity: "All", fir_stage: "All", fir_year: "All", fir_month: "All", confidence_min: "" };
const emptyOptions: PatternFilterOptions = { districts: [], policeStations: [], crimeTypes: [], patternTypes: [], severities: [], statuses: [], years: [], months: [] };
const emptySummary: PatternSummary = { total_patterns_detected: 0, critical_patterns: 0, high_confidence_patterns: 0, most_affected_district: "No data", most_repeated_crime_type: "No data", latest_detected_pattern: "No patterns" };
const emptyCharts: PatternCharts = { pattern_count_by_type: [], severity_distribution: [], districts_with_most_patterns: [], crime_types_with_most_patterns: [], monthly_pattern_trend: [] };
const categories = ["All", "Repeated Crime Type Pattern", "Seasonal Crime Spike", "Police Station Concentration", "Crime Head Concentration Pattern", "Heinous Crime Pattern", "FIR Stage Pattern", "Complaint Mode Pattern", "Low Conviction / High Accused Gap", "Data Quality Pattern", "Emerging Crime Category"];

const severityClass = {
  Critical: "border-alert-critical/60 bg-alert-critical/10 text-alert-critical",
  High: "border-alert-high/60 bg-alert-high/10 text-alert-high",
  Medium: "border-alert-medium/60 bg-alert-medium/10 text-alert-medium",
  Low: "border-alert-low/60 bg-alert-low/10 text-alert-low"
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

const PatternCard = ({ pattern, onOpen }: { pattern: CrimePattern; onOpen: (pattern: CrimePattern) => void }) => (
  <article className="card-safe rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-safe truncate-2 text-lg font-semibold text-white" title={pattern.title}>{pattern.title}</h3>
        <p className="text-safe mt-1 text-sm text-command-300">{pattern.pattern_type}</p>
      </div>
      <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${severityClass[pattern.severity]}`}>{pattern.severity}</span>
    </div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
      <div className="rounded border border-command-700 bg-command-850 p-2 text-slate-300">District: <span className="text-white">{pattern.district || "Statewide"}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-2 text-slate-300">Station: <span className="text-white">{pattern.police_station || "N/A"}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-2 text-slate-300">Crime: <span className="text-white">{pattern.crime_type || "All"}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-2 text-slate-300">Crime Head: <span className="text-white">{pattern.crime_subtype || "N/A"}</span></div>
      <div className="rounded border border-command-700 bg-command-850 p-2 text-slate-300">Confidence: <span className="text-white">{pattern.confidence_score}%</span></div>
    </div>
    <p className="text-safe mt-4 text-sm leading-6 text-slate-300">{pattern.explanation}</p>
    <button className="mt-4 flex items-center gap-2 rounded-md border border-command-700 px-3 py-2 text-sm text-command-300 hover:bg-command-850" onClick={() => onOpen(pattern)} type="button">
      <Eye className="h-4 w-4" />
      View Details
    </button>
  </article>
);

const optionList = (options: PatternFilterOptions, primary: keyof PatternFilterOptions, fallback?: keyof PatternFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const PatternDiscovery = () => {
  const [filters, setFilters] = useState<PatternFilters>(emptyFilters);
  const [options, setOptions] = useState<PatternFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<PatternSummary>(emptySummary);
  const [patterns, setPatterns] = useState<CrimePattern[]>([]);
  const [whispers, setWhispers] = useState<string[]>([]);
  const [charts, setCharts] = useState<PatternCharts>(emptyCharts);
  const [category, setCategory] = useState("All");
  const [selectedPattern, setSelectedPattern] = useState<CrimePattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadPatterns = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [filtersRes, summaryRes, discoverRes, whispersRes, chartsRes] = await Promise.all([
        patternService.getFilters(),
        patternService.getSummary(nextFilters),
        patternService.discover(nextFilters),
        patternService.getWhispers(nextFilters),
        patternService.getCharts(nextFilters)
      ]);
      setOptions(filtersRes.data);
      setSummary(summaryRes.data);
      setPatterns(discoverRes.data);
      setWhispers(whispersRes.data);
      setCharts({ ...emptyCharts, ...chartsRes.data });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Pattern Discovery Engine.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Pattern Discovery API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    loadPatterns();
  }, []);
  const updateFilter = (key: keyof PatternFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const visiblePatterns = category === "All" ? patterns : patterns.filter((pattern) => pattern.pattern_type === category);

  if (loading) return <StateBlock title="Loading Pattern Discovery Engine" message="Detecting hidden crime patterns from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Pattern engine unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV records first to activate Pattern Discovery Engine."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Pattern API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadPatterns(filters)} type="button">
            Retry Patterns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Pattern Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">Pattern Discovery Engine</h1>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadPatterns(filters)} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh Patterns
        </button>
      </div>

      <div className="stat-grid">
        <DashboardCard title="Total Patterns Detected" value={summary.total_patterns_detected} icon={BrainCircuit} />
        <DashboardCard title="Critical Patterns" value={summary.critical_patterns} icon={Siren} tone="red" />
        <DashboardCard title="High Confidence" value={summary.high_confidence_patterns} icon={Target} tone="green" />
        <DashboardCard title="Most Affected District" value={summary.most_affected_district} icon={ShieldAlert} tone="orange" />
        <DashboardCard title="Repeated Crime Type" value={summary.most_repeated_crime_type} icon={Filter} />
        <DashboardCard title="Latest Pattern" value={summary.latest_detected_pattern} icon={BrainCircuit} valueClassName={summary.latest_detected_pattern.length > 28 ? "text-[clamp(1.2rem,1.6vw,1.7rem)]" : ""} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Pattern Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Pattern Type" value={filters.pattern_type} options={optionList(options, "patternTypes", "pattern_type")} onChange={(value) => updateFilter("pattern_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Confidence Min
            <input className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm text-white outline-none focus:border-command-300" min="0" max="100" type="number" value={filters.confidence_min || ""} onChange={(event) => updateFilter("confidence_min", event.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadPatterns(filters)} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadPatterns(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Pattern Categories</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button key={item} className={`rounded border px-3 py-2 text-xs font-semibold ${category === item ? "border-command-300 bg-command-700 text-white" : "border-command-700 bg-command-850 text-slate-300"}`} onClick={() => setCategory(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingBarChart title="Pattern Count by Type" data={charts.pattern_count_by_type} />
        <DistributionPieChart title="Pattern Severity Distribution" data={charts.severity_distribution} />
        <RankingBarChart title="Districts with Most Patterns" data={charts.districts_with_most_patterns} color="#f97316" />
        <RankingBarChart title="Crime Types with Most Patterns" data={charts.crime_types_with_most_patterns} color="#22c55e" />
        <RankingBarChart title="Monthly Pattern Trend" data={charts.monthly_pattern_trend} color="#ef4444" />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Pattern Whisper Alerts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {whispers.length === 0 ? (
            <p className="text-sm text-slate-400">No major pattern whispers detected for the selected filters.</p>
          ) : whispers.map((whisper) => <div key={whisper} className="rounded border border-command-700 bg-command-850 p-3 text-sm text-command-300">{whisper}</div>)}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {visiblePatterns.length === 0 ? (
          <div className="xl:col-span-2">
            <StateBlock title="No major patterns detected" message="No major crime patterns were detected for the selected filters." />
          </div>
        ) : visiblePatterns.map((pattern) => <PatternCard key={pattern.pattern_id} pattern={pattern} onOpen={setSelectedPattern} />)}
      </div>

      {selectedPattern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-command-700 bg-command-900 p-6 shadow-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-command-300">{selectedPattern.pattern_type}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedPattern.title}</h2>
              </div>
              <button className="rounded border border-command-700 p-2 text-slate-300 hover:bg-command-850" onClick={() => setSelectedPattern(null)} type="button"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">District: {selectedPattern.district || "Statewide"}</div>
              <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Police station: {selectedPattern.police_station || "N/A"}</div>
              <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Crime type: {selectedPattern.crime_type || "All"}</div>
              <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Crime head: {selectedPattern.crime_subtype || "N/A"}</div>
              <div className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">Confidence: {selectedPattern.confidence_score}%</div>
            </div>
            <h3 className="mt-6 font-semibold text-white">Full Explanation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{selectedPattern.explanation}</p>
            <h3 className="mt-6 font-semibold text-white">Data Evidence</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">{selectedPattern.evidence.map((item) => <li key={item}>- {item}</li>)}</ul>
            <h3 className="mt-6 font-semibold text-white">Why It Matters</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">This pattern identifies repeatable operational pressure that can guide preventive deployment, investigation follow-up, and data quality improvement.</p>
            <h3 className="mt-6 font-semibold text-white">Recommended Preventive Action</h3>
            <p className="mt-2 rounded border border-command-700 bg-command-850 p-3 text-sm text-command-300">{selectedPattern.suggested_action}</p>
          </section>
        </div>
      )}
    </div>
  );
};

export default PatternDiscovery;
