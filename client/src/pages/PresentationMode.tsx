import { ArrowRight, Bot, BrainCircuit, Clock3, CloudSun, Database, FileText, Flame, Map, Presentation, Shield, Sparkles, Target, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DatasetStatusWidget from "../components/DatasetStatusWidget";
import StateBlock from "../components/StateBlock";
import { dashboardService } from "../services/dashboardService";
import type { GlobalStats } from "../types/crime";

const flowSteps = [
  "CSV Crime Records",
  "Catalyst Data Store",
  "Analytics Engine",
  "Risk Scoring",
  "Red-Zone Alerts",
  "Prediction",
  "AI Reports"
];

const journey = [
  { title: "Upload crime data", description: "Import the Karnataka FIR CSV and map real source columns into CrimeRecords.", to: "/upload", icon: UploadCloud },
  { title: "View dashboard", description: "See KPIs, trends, distributions, rankings, and recent records.", to: "/dashboard", icon: Database },
  { title: "Analyze District Risk DNA", description: "Open explainable district risk scores and recommended police actions.", to: "/district-risk-dna", icon: Shield },
  { title: "Detect Red-Zone Alerts", description: "Review anomaly spikes and high-risk operational alerts.", to: "/alerts", icon: Flame },
  { title: "Explore Hotspot Map", description: "Inspect coordinate-backed heat zones and district intensity.", to: "/hotspot-map", icon: Map },
  { title: "Use Crime Time Machine", description: "Compare crime periods and movement patterns over time.", to: "/crime-time-machine", icon: Clock3 },
  { title: "Check Crime Weather Forecast", description: "Review rule-based future risk forecasts from historical signals.", to: "/crime-forecast", icon: CloudSun },
  { title: "Generate AI Intelligence Report", description: "Create a Catalyst-backed PDF report with Gemini/rule-based fallback.", to: "/ai-report", icon: FileText }
];

const features = [
  { title: "Crime Weather Forecast", detail: "Predictive risk labels and confidence from uploaded records.", icon: CloudSun },
  { title: "Crime Time Machine", detail: "Period comparison for trends, increases, and movement patterns.", icon: Clock3 },
  { title: "District Risk DNA", detail: "Explainable scorecard for every district.", icon: Shield },
  { title: "Red-Zone Pulse Alert", detail: "Animated critical anomaly cards for urgent attention.", icon: Flame },
  { title: "Why This Risk?", detail: "Transparent factors behind every score and alert.", icon: BrainCircuit },
  { title: "AI Intelligence Report", detail: "Officer-ready PDF reports from calculated analytics.", icon: FileText },
  { title: "Heat-to-Action Recommendation", detail: "Hotspot signals converted into deployment actions.", icon: Target },
  { title: "Pattern Whisper Alerts", detail: "Short messages for emerging crime patterns.", icon: Sparkles }
];

const impacts = [
  "Faster crime analysis",
  "Better district comparison",
  "Proactive policing",
  "Data-driven resource allocation",
  "Automated intelligence reports",
  "Explainable AI support"
];

const stack = [
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Recharts",
  "MapLibre",
  "Zoho Catalyst Functions",
  "Zoho Catalyst Data Store",
  "Zoho Catalyst Authentication",
  "Gemini API"
];

const PresentationMode = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await dashboardService.getGlobalStats();
      setStats(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load presentation stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const hasData = (stats?.total_records ?? 0) > 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-md border border-command-700 bg-command-900/85 shadow-glow">
        <div className="relative p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-command-300 via-alert-critical to-alert-medium" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-command-300">Hackathon Presentation Mode</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">CrimePulse AI</h1>
              <p className="mt-3 max-w-3xl text-base text-slate-300">AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police.</p>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-command-300">CrimePulse AI transforms Karnataka Police crime records into a live intelligence command center that detects hotspots, predicts risk, explains crime patterns, and recommends preventive action.</p>
            </div>
            <div className="rounded-md border border-command-500/50 bg-command-950/80 p-4 text-sm text-slate-300">
              <p className="font-semibold text-command-300">Demo Data Safety</p>
              <p className="mt-2">Using uploaded Karnataka crime dataset.</p>
              <p>AI explanations are generated from calculated analytics only.</p>
              <p>No AI-generated statistics are invented.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <p className="text-sm uppercase tracking-[0.18em] text-alert-medium">Problem</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Manual records hide operational signals</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Manual crime records make it difficult to detect hidden crime patterns, compare districts, and predict emerging risks.</p>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Solution</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">A police command center for crime intelligence</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">CrimePulse AI converts crime records into an AI-powered crime intelligence command center.</p>
        </section>
      </div>

      {loading ? (
        <StateBlock title="Loading live data summary" message="Fetching Catalyst dashboard global stats." />
      ) : error ? (
        <StateBlock title="Presentation stats unavailable" message={error} />
      ) : (
        <DatasetStatusWidget stats={stats} />
      )}

      {!hasData && !loading && (
        <StateBlock title="No crime data uploaded yet" message="Upload CSV records first to activate the live-data portions of Presentation Mode." />
      )}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex items-center gap-3">
          <Presentation className="h-5 w-5 text-command-300" />
          <h2 className="text-xl font-semibold text-white">Intelligence Flow</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-7">
          {flowSteps.map((step, index) => (
            <div key={step} className="relative rounded-md border border-command-700 bg-command-850 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">{step}</p>
              {index < flowSteps.length - 1 && <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-command-300 md:block" />}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-xl font-semibold text-white">Demo Journey</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {journey.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-md border border-command-700 bg-command-850 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-command-300" />
                  <span className="text-xs text-slate-500">Step {index + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 min-h-16 text-sm leading-6 text-slate-400">{step.description}</p>
                <Link className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-command-500 px-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to={step.to}>
                  Open Module
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-xl font-semibold text-white">Unique Features Showcase</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-md border border-command-700 bg-command-850 p-4 transition hover:border-command-300/70">
                <Icon className="h-5 w-5 text-command-300" />
                <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Impact</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {impacts.map((impact) => (
              <div key={impact} className="rounded border border-command-700 bg-command-850 px-3 py-3 text-sm text-slate-200">{impact}</div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-xl font-semibold text-white">Tech Stack</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {stack.map((item) => (
              <span key={item} className="rounded border border-command-500/50 bg-command-500/10 px-3 py-2 text-sm text-command-300">{item}</span>
            ))}
          </div>
          <div className="mt-5 rounded border border-command-700 bg-command-950/70 p-4 text-sm leading-6 text-slate-300">
            <Bot className="mb-2 h-5 w-5 text-command-300" />
            Catalyst Functions aggregate the data. Gemini is used only for explanations from those calculated analytics, with a rule-based fallback when the API key is not configured.
          </div>
        </section>
      </div>
    </div>
  );
};

export default PresentationMode;
