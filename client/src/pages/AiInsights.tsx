import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, FileWarning, Loader2, MessageSquareText, RefreshCw, Search, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { MotionCard, MotionSection, useInView } from "../components/animation";
import { aiService } from "../services/aiService";
import { crimeService } from "../services/crimeService";
import type { AiAskResponse, AiGeneratedInsight, AiInsightFilterOptions, AiInsightFilters, AiRecommendation, AiSummary } from "../types/crime";

const allFilters: AiInsightFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All"
};

const emptyOptions: AiInsightFilterOptions = {
  districts: [],
  policeStations: [],
  years: [],
  months: [],
  crimeTypes: [],
  severities: ["Critical", "High", "Medium", "Low"],
  statuses: [],
  timeRanges: []
};

const cleanFilters = (filters: AiInsightFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value && String(value).toLowerCase() !== "all")) as AiInsightFilters;

const getCount = (body: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  body.totalRecords ?? body.data?.totalRecords ?? 0;

const riskClass = (level?: string) => {
  if (level === "Critical") return "border-alert-critical/50 bg-alert-critical/15 text-alert-critical";
  if (level === "High") return "border-alert-high/50 bg-alert-high/15 text-alert-high";
  if (level === "Medium") return "border-alert-medium/50 bg-alert-medium/15 text-alert-medium";
  return "border-command-500/50 bg-command-500/10 text-command-300";
};

const optionValues = (options: AiInsightFilterOptions, key: keyof AiInsightFilters) => {
  if (key === "fir_year") return options.fir_year || options.years || [];
  if (key === "fir_month") return options.fir_month || options.months || [];
  if (key === "district") return options.district || options.districts || [];
  if (key === "police_station") return options.police_station || options.policeStations || [];
  if (key === "crime_type") return options.crime_type || options.crimeTypes || [];
  if (key === "fir_stage") return options.fir_stage || options.statuses || [];
  if (key === "severity") return options.severities || [];
  return [];
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

const Typewriter = ({ text }: { text: string }) => {
  const [ref, visible] = useInView();
  const [shown, setShown] = useState("");
  useEffect(() => { if (!visible) return; let frame = 0; const start = performance.now(); const tick = (now: number) => { const amount = Math.min(text.length, Math.floor((now - start) / 600 * text.length)); setShown(text.slice(0, amount)); if (amount < text.length) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [text, visible]);
  return <p ref={ref} className="mt-4 text-sm leading-6 text-slate-300">{shown}</p>;
};

const InsightCard = ({ insight }: { insight: AiGeneratedInsight }) => (
  <MotionCard glowColor="purple"><article className={`rounded-md border bg-command-900/85 p-5 shadow-glow ${riskClass(insight.priority)}`}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] opacity-80">{insight.type}</p>
        <h3 className="mt-2 text-lg font-semibold text-white">{insight.title}</h3>
      </div>
      <span className="rounded border border-current/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">{insight.priority}</span>
    </div>
    <Typewriter text={insight.explanation} />
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-300">
        {insight.evidence.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
    <div className="mt-4 rounded border border-command-700 bg-command-950/70 p-3 text-sm text-command-300">
      {insight.recommendation}
    </div>
    <p className="mt-3 text-xs text-slate-500">Confidence: {insight.confidence}%</p>
  </article></MotionCard>
);

const AiInsights = () => {
  const [filters, setFilters] = useState<AiInsightFilters>(allFilters);
  const [options, setOptions] = useState<AiInsightFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [insights, setInsights] = useState<AiGeneratedInsight[]>([]);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAskResponse | null>(null);
  const [storedCount, setStoredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const activeFilters = useMemo(() => cleanFilters(filters), [filters]);
  const hasFilters = Object.keys(activeFilters).length > 0;

  const loadData = async (nextFilters: AiInsightFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      const countResponse = await crimeService.getCrimeCount();
      const count = getCount(countResponse);
      setStoredCount(count);

      const clean = cleanFilters(nextFilters);
      const [filterResponse, summaryResponse, insightsResponse, recommendationsResponse] = await Promise.all([
        aiService.getFilters(),
        aiService.getSummary(clean),
        aiService.getInsights(clean),
        aiService.getRecommendations(clean)
      ]);

      setOptions({ ...emptyOptions, ...filterResponse.data });
      setSummary(summaryResponse.data);
      setInsights(insightsResponse.data || []);
      setRecommendations(recommendationsResponse.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI module failed.";
      try {
        const countResponse = await crimeService.getCrimeCount();
        const count = getCount(countResponse);
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but AI module failed. ${message}` : message);
      } catch {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(allFilters);
  }, []);

  const updateFilter = (key: keyof AiInsightFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(allFilters);
    setAnswer(null);
    loadData(allFilters);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    try {
      setAsking(true);
      setAnswer(null);
      const response = await aiService.ask(question.trim(), activeFilters);
      setAnswer(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to ask CrimePulse AI.");
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-md bg-command-900" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-28 animate-pulse rounded-md bg-command-900" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">CrimePulse AI Intelligence</p>
          <h1 className="text-3xl font-semibold text-white">AI Insights</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Rule-based intelligence with Gemini-ready summarization. Raw crime rows stay in Catalyst; only summaries are used for AI responses.</p>
        </div>
        <button className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadData(filters)} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500/50 bg-command-850">
              <Bot className="h-5 w-5 text-command-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Mode: {summary?.ai_mode || "Rule-based"}</h2>
              <p className="text-sm text-slate-400">{storedCount.toLocaleString()} stored records available. {hasFilters ? "Filtered intelligence active." : "Showing all records."}</p>
            </div>
          </div>
          <div className="rounded border border-command-300/30 bg-command-500/10 px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-command-300">
            {summary?.ai_mode === "Gemini" ? "GEMINI AI" : "RULE ENGINE"}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">AI Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionValues(options, "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionValues(options, "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="District" value={filters.district} options={optionValues(options, "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionValues(options, "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionValues(options, "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionValues(options, "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionValues(options, "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="flex min-h-11 items-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadData(filters)} type="button">
            <Search className="h-4 w-4" />
            Apply Filters
          </button>
          <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={clearFilters} type="button">
            <Target className="h-4 w-4" />
            Clear Filters
          </button>
        </div>
      </section>

      {error && <StateBlock title={storedCount > 0 ? "Records found, but AI module failed." : "AI insights unavailable"} message={error} />}

      {!summary && !error && <StateBlock title="No crime data available" message="Upload CSV records first to activate AI Insights." />}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard title="Records Analyzed" value={summary.records_analyzed.toLocaleString()} icon={BrainCircuit} />
            <DashboardCard title="Highest Risk District" value={summary.highest_risk_district || "N/A"} icon={ShieldAlert} tone="red" />
            <DashboardCard title="Dominant Crime Type" value={summary.dominant_crime_type || "N/A"} icon={Sparkles} tone="orange" />
            <DashboardCard title="Risk Score" value={`${summary.risk_score}/100`} icon={TrendingUp} tone={summary.risk_level === "Critical" || summary.risk_level === "High" ? "red" : "blue"} />
          </div>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow lg:col-span-2">
              <h2 className="text-base font-semibold text-white">Operational Summary</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded border border-command-700 bg-command-850 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Strongest Pattern</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{summary.strongest_pattern}</p>
                </div>
                <div className="rounded border border-command-700 bg-command-850 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Main Operational Gap</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{summary.main_operational_gap}</p>
                </div>
              </div>
            </div>
            <div className={`rounded-md border p-5 shadow-glow ${riskClass(summary.risk_level)}`}>
              <p className="text-xs uppercase tracking-[0.16em] opacity-80">Risk Level</p>
              <p className="mt-3 text-4xl font-semibold">{summary.risk_level}</p>
              <p className="mt-4 text-sm text-slate-300">Arrest rate {summary.arrest_rate}% | Conviction rate {summary.conviction_rate}% | Geo availability {summary.coordinate_available_percentage}%</p>
            </div>
          </section>

          <MotionSection><section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Generated Insight Cards</h2>
            {insights.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No AI insights found for the selected filters.</p>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {insights.map((insight) => <InsightCard key={insight.insight_id} insight={insight} />)}
              </div>
            )}
          </section></MotionSection>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <div className="flex items-center gap-3">
                <MessageSquareText className="h-5 w-5 text-command-300" />
                <h2 className="text-base font-semibold text-white">Ask CrimePulse AI</h2>
              </div>
              <textarea className="mt-4 min-h-28 w-full rounded-md border border-command-700 bg-command-850 p-3 text-sm text-white outline-none focus:border-command-300" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about crime risk, hotspots, FIR stages, arrests, convictions, or prevention strategy..." />
              <button className="mt-3 flex min-h-11 items-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:opacity-60" disabled={asking || !question.trim()} onClick={askQuestion} type="button">
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {asking ? "Analyzing..." : "Ask AI"}
              </button>
              {asking && <p className="mt-3 flex items-center gap-2 text-xs italic text-slate-400"><span className="ai-thinking-dots"><i/><i/><i/></span>AI is analyzing patterns...</p>}
              {answer && (
                <div className="mt-4 rounded border border-command-700 bg-command-950/70 p-4 text-sm leading-6 text-slate-200">
                  <p className="text-xs uppercase tracking-[0.14em] text-command-300">{answer.ai_mode} answer from {answer.records_analyzed.toLocaleString()} records</p>
                  <p className="mt-3 whitespace-pre-line">{answer.answer}</p>
                </div>
              )}
            </div>

            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <div className="flex items-center gap-3">
                <FileWarning className="h-5 w-5 text-alert-high" />
                <h2 className="text-base font-semibold text-white">Recommended Police Actions</h2>
              </div>
              {recommendations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No recommendations available for the selected filters.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recommendations.map((item) => (
                    <div key={`${item.title}-${item.action}`} className="rounded border border-command-700 bg-command-850 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <span className={`rounded border px-2 py-1 text-xs ${riskClass(item.priority)}`}>{item.priority}</span>
                      </div>
                      <p className="mt-2 text-sm text-command-300">{item.action}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AiInsights;
