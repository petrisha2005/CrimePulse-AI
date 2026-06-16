import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CloudSun,
  Database,
  FileText,
  Flame,
  LockKeyhole,
  Map,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AnimatedBackground from "../components/home/AnimatedBackground";
import { authService } from "../services/authService";

const problemCards = [
  "Crime data scattered across files and silos",
  "Manual Excel-based reporting slows intelligence analysis",
  "Hidden crime patterns are difficult to detect",
  "District and police-station comparisons are time-consuming",
  "Current analysis is mostly reactive, not predictive",
  "Socio-economic reasons behind crime are not deeply explored"
];

const flowSteps = [
  "CSV Crime Records",
  "Catalyst Data Store",
  "Analytics Engine",
  "Risk Scoring",
  "Red-Zone Alerts",
  "Forecasting",
  "AI Intelligence Reports"
];

const features = [
  {
    title: "Crime Command Dashboard",
    description: "Real-time overview of crime counts, trends, districts, police stations, and FIR stages.",
    icon: BarChart3
  },
  {
    title: "Karnataka Hotspot Map",
    description: "Visualize crime intensity using coordinate-based markers and district-level heat intelligence.",
    icon: Map
  },
  {
    title: "District Risk DNA",
    description: "Every district gets an explainable crime profile with risk score, dominant crime type, peak period, and recommended action.",
    icon: ShieldCheck
  },
  {
    title: "Red-Zone Pulse Alerts",
    description: "Detect sudden crime spikes, anomalies, concentration zones, and critical alerts.",
    icon: Flame
  },
  {
    title: "Crime Time Machine",
    description: "Move through time to see how crime patterns shift across districts and police stations.",
    icon: Clock3
  },
  {
    title: "Crime Weather Forecast",
    description: "Predict district-level crime risk like a weather forecast for today, tomorrow, and upcoming periods.",
    icon: CloudSun
  },
  {
    title: "Socio-Economic Insights",
    description: "Connect crime trends with urbanization, population density, migration, digital access, and economic stress.",
    icon: Activity
  },
  {
    title: "Pattern Discovery Engine",
    description: "Automatically discover seasonal spikes, repeated crimes, emerging categories, and low-conviction gaps.",
    icon: BrainCircuit
  },
  {
    title: "AI Intelligence Reports",
    description: "Generate officer-friendly reports with summaries, risk explanations, forecasts, and prevention strategies.",
    icon: FileText
  },
  {
    title: "Heat-to-Action Recommendations",
    description: "Convert hotspots and risk signals into direct policing actions.",
    icon: Target
  }
];

const traditional = [
  "Static Excel sheets",
  "Manual summaries",
  "Reactive analysis",
  "Limited district comparison",
  "No explainable prediction",
  "No automated reports"
];

const crimePulse = [
  "Interactive dashboards",
  "Live hotspot intelligence",
  "Predictive risk scoring",
  "District Risk DNA",
  "Red-Zone Pulse Alerts",
  "AI-generated intelligence reports",
  "Actionable recommendations"
];

const previewStats = [
  { label: "Total records analyzed", value: "16L+", icon: Database },
  { label: "Districts covered", value: "31", icon: Map },
  { label: "Crime groups detected", value: "40+", icon: BrainCircuit },
  { label: "High-risk districts", value: "Live", icon: Flame },
  { label: "Forecast risk", value: "Daily", icon: CloudSun },
  { label: "Active alerts", value: "Pulse", icon: AlertTriangle }
];

const journey = [
  "Login securely",
  "Upload crime CSV records",
  "View crime command dashboard",
  "Analyze District Risk DNA",
  "Explore hotspot map and red-zone alerts",
  "Generate AI intelligence report"
];

const techStack = [
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

const impacts = [
  "Faster crime analysis",
  "Better district comparison",
  "Proactive policing",
  "Data-driven resource allocation",
  "Automated intelligence reports",
  "Explainable AI decision support",
  "Improved data quality awareness"
];

const SectionHeading = ({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) => (
  <div className="mx-auto max-w-3xl text-center">
    <p className="text-sm uppercase tracking-[0.18em] text-command-300">{eyebrow}</p>
    <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{title}</h2>
    {description && <p className="mt-4 text-sm leading-6 text-slate-400 md:text-base">{description}</p>}
  </div>
);

const FeatureCard = ({ title, description, icon: Icon }: { title: string; description: string; icon: typeof ShieldCheck }) => (
  <div className="group rounded-md border border-command-700 bg-command-900/80 p-5 shadow-glow transition hover:-translate-y-1 hover:border-command-300/70 hover:bg-command-850">
    <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500/60 bg-command-850 transition group-hover:border-command-300">
      <Icon className="h-5 w-5 text-command-300" />
    </div>
    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
    <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
  </div>
);

const HomePage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authService.checkAuthStatus().then(setAuthenticated).catch(() => setAuthenticated(false));
  }, []);

  const presentationTarget = authenticated ? "/presentation-mode" : "/login";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040b14] text-slate-100">
      <AnimatedBackground />
      <section className="relative z-10 border-b border-command-700/60">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(46,139,216,0.18),transparent_35%),linear-gradient(180deg,rgba(10,23,40,0.1),rgba(4,11,20,0.92)_92%)]" />
        <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <nav className="col-span-full flex items-center justify-between gap-4 rounded-md border border-command-700/70 bg-command-950/45 px-4 py-3 shadow-glow backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500/60 bg-command-900/80">
                <Radar className="h-6 w-6 text-command-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-command-300">Karnataka Police</p>
                <p className="text-lg font-semibold text-white">CrimePulse AI</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {authenticated && (
                <Link className="hidden min-h-10 items-center rounded-md border border-command-700 px-4 text-sm font-semibold text-slate-200 hover:bg-command-850 sm:flex" to="/dashboard">
                  Open Dashboard
                </Link>
              )}
              <Link className="flex min-h-10 items-center rounded-md bg-command-500 px-4 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/login">
                Login
              </Link>
            </div>
          </nav>

          <div className="flex flex-col justify-center pb-8 pt-8 lg:pb-20">
            <div className="inline-flex w-fit items-center gap-2 rounded border border-command-500/50 bg-command-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-command-300">
              <Sparkles className="h-4 w-4" />
              Live Crime Intelligence Platform
            </div>
            <div className="mt-6 rounded-md border border-command-700/70 bg-command-950/55 p-5 shadow-glow backdrop-blur-md sm:p-6">
              <h1 className="text-5xl font-semibold leading-tight text-white drop-shadow-[0_0_26px_rgba(0,212,255,0.22)] md:text-7xl">CrimePulse AI</h1>
              <p className="mt-5 max-w-3xl text-xl font-medium leading-8 text-command-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]">
                AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police
              </p>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]">
                Transform manual crime records into a live intelligence command center that detects hotspots, predicts emerging risks, explains crime patterns, and recommends preventive action.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-command-500 px-5 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/login">
                <LockKeyhole className="h-4 w-4" />
                Login to Command Center
              </Link>
              <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-900/70 px-5 text-sm font-semibold text-slate-200 hover:bg-command-850" href="#demo-journey">
                View Demo Journey
                <ArrowRight className="h-4 w-4" />
              </a>
              {authenticated && (
                <Link className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-alert-low/50 bg-alert-low/10 px-5 text-sm font-semibold text-alert-low hover:bg-alert-low/20" to="/dashboard">
                  Open Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center pb-12 lg:pb-20">
            <div className="relative w-full max-w-xl">
              <div className="crime-radar relative mx-auto flex aspect-square max-h-[520px] max-w-[520px] items-center justify-center rounded-full border border-command-500/30 bg-command-900/30 backdrop-blur-sm">
                <div className="absolute h-[78%] w-[78%] rounded-full border border-command-500/30" />
                <div className="absolute h-[54%] w-[54%] rounded-full border border-command-500/30" />
                <div className="absolute h-[30%] w-[30%] rounded-full border border-command-500/30" />
                <div className="crime-sweep absolute h-[46%] w-[46%] origin-bottom rounded-t-full bg-command-300/10" />
                <div className="crime-pulse-dot absolute right-[22%] top-[30%] h-4 w-4 rounded-full bg-alert-critical shadow-[0_0_28px_rgba(239,68,68,0.85)]" />
                <div className="crime-pulse-dot absolute bottom-[24%] left-[28%] h-3 w-3 rounded-full bg-alert-medium shadow-[0_0_24px_rgba(250,204,21,0.7)]" />
              </div>
              <div className="absolute left-0 top-8 rounded-md border border-command-700 bg-command-950/80 p-4 shadow-glow backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Risk Score</p>
                <p className="mt-1 text-2xl font-semibold text-alert-high">78/100</p>
                <p className="text-xs text-slate-400">High attention zone</p>
              </div>
              <div className="absolute right-0 top-24 rounded-md border border-alert-critical/50 bg-alert-critical/15 p-4 shadow-glow backdrop-blur-md">
                <p className="flex items-center gap-2 text-sm font-semibold text-alert-critical"><Flame className="h-4 w-4" /> Red-Zone Alert</p>
                <p className="mt-1 text-xs text-slate-300">Spike detected in district cluster</p>
              </div>
              <div className="absolute bottom-10 left-8 right-8 rounded-md border border-command-700 bg-command-950/80 p-5 shadow-glow backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-command-300">Dashboard Preview</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Crime forecast: Elevated</h2>
                    <p className="mt-2 text-sm text-slate-400">Hotspots, risk DNA, alerts, and prevention strategy in one workflow.</p>
                  </div>
                  <CloudSun className="h-8 w-8 text-command-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Problem" title="The Challenge: Moving Beyond Manual Crime Records" />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {problemCards.map((item) => (
            <div key={item} className="rounded-md border border-command-700 bg-command-900/80 p-5">
              <AlertTriangle className="h-5 w-5 text-alert-medium" />
              <p className="mt-4 text-sm leading-6 text-slate-300">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-command-700/60 bg-command-900/45 px-4 py-20 backdrop-blur-sm sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Solution"
          title="From Static Records to Live Crime Intelligence"
          description="CrimePulse AI converts historical FIR and crime records into interactive dashboards, hotspot maps, district risk profiles, anomaly alerts, predictive forecasts, and AI-generated intelligence reports."
        />
        <div className="mx-auto mt-10 grid max-w-7xl gap-3 lg:grid-cols-7">
          {flowSteps.map((step, index) => (
            <div key={step} className="relative rounded-md border border-command-700 bg-command-950/70 p-4 text-center text-sm font-semibold text-slate-200">
              {step}
              {index < flowSteps.length - 1 && <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-command-300 lg:block" />}
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Features" title="Built for Crime Intelligence Workflows" />
        <div className="mx-auto mt-10 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </div>
      </section>

      <section className="relative z-10 border-y border-command-700/60 bg-command-900/45 px-4 py-20 backdrop-blur-sm sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Difference" title="Not Just a Dashboard. A Crime Intelligence Command Center." />
        <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-command-700 bg-command-950/70 p-6">
            <h3 className="text-xl font-semibold text-slate-200">Traditional Reporting</h3>
            <div className="mt-5 space-y-3">
              {traditional.map((item) => <p key={item} className="rounded border border-command-700 bg-command-900 px-3 py-3 text-sm text-slate-400">{item}</p>)}
            </div>
          </div>
          <div className="rounded-md border border-command-300/50 bg-command-500/10 p-6 shadow-glow">
            <h3 className="text-xl font-semibold text-white">CrimePulse AI</h3>
            <div className="mt-5 space-y-3">
              {crimePulse.map((item) => (
                <p key={item} className="flex items-center gap-2 rounded border border-command-500/50 bg-command-900/80 px-3 py-3 text-sm text-command-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Platform Preview" title="Live Intelligence Preview" description="Sample/static preview values for homepage display only. Actual metrics come from the protected Catalyst dashboard after data upload." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {previewStats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <Icon className="h-5 w-5 text-command-300" />
              <p className="mt-4 text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo-journey" className="relative z-10 border-y border-command-700/60 bg-command-900/45 px-4 py-20 backdrop-blur-sm sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Demo Journey" title="How Officers Use CrimePulse AI" />
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {journey.map((step, index) => (
            <div key={step} className="rounded-md border border-command-700 bg-command-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-command-300">Step {index + 1}</p>
              <p className="mt-3 text-lg font-semibold text-white">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-command-500 px-5 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/login">
            Start Demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Stack" title="Catalyst-Ready Technology Stack" />
        <div className="mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-3">
          {techStack.map((item) => (
            <span key={item} className="rounded border border-command-500/50 bg-command-500/10 px-4 py-3 text-sm font-semibold text-command-300">{item}</span>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-command-700/60 bg-command-900/45 px-4 py-20 backdrop-blur-sm sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Impact" title="Operational Impact for Police Teams" />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {impacts.map((impact) => (
            <div key={impact} className="rounded-md border border-command-700 bg-command-950/70 p-5 text-sm font-semibold text-slate-200">{impact}</div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-md border border-command-500/50 bg-command-900/90 p-8 text-center shadow-glow">
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Command Center Ready</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Turn Crime Records into Actionable Intelligence</h2>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
            CrimePulse AI helps police teams understand where crime is happening, why patterns are emerging, what risks may rise next, and what action should be taken.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-command-500 px-5 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/login">
              Login to Command Center
            </Link>
            <button className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-5 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => navigate(presentationTarget)} type="button">
              Explore Presentation Mode
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
