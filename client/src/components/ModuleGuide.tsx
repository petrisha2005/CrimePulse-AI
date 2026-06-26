import { ArrowRight, CheckCircle2, FileText, Info, MapPinned, Siren, TimerReset, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export type ModuleGuideItem = {
  title: string;
  purpose: string;
};

export const moduleGuidance: Record<string, ModuleGuideItem> = {
  "/dashboard": { title: "Command Dashboard", purpose: "Gives a quick command-level summary of uploaded crime records." },
  "/upload": { title: "Upload Crime Data", purpose: "Uploads and stores FIR/crime CSV records for analysis." },
  "/records": { title: "Crime Records", purpose: "Lets users search, filter, and inspect stored crime records." },
  "/district-risk-dna": { title: "District Risk DNA", purpose: "Shows the risk profile of each district based on crime volume, severity, and police station concentration." },
  "/alerts": { title: "Red-Zone Alerts", purpose: "Highlights urgent high-risk signals and anomaly-like crime patterns." },
  "/pattern-discovery": { title: "Pattern Discovery", purpose: "Finds repeated crime types, station concentration, seasonal patterns, and data quality signals." },
  "/hotspot-map": { title: "Hotspot Map", purpose: "Visualizes crime concentration geographically using exact coordinates or district fallback." },
  "/crime-time-machine": { title: "Crime Time Machine", purpose: "Shows how crime changes over months and years." },
  "/crime-forecast": { title: "Crime Forecast", purpose: "Provides historical risk-based forecast indicators for future planning." },
  "/socio-economic-insights": { title: "Socio-Economic Insights", purpose: "Uses crime-derived proxy indicators to understand vulnerability, workload, and resolution gaps." },
  "/district-analytics": { title: "District Analytics", purpose: "Compares districts, police stations, crime types, and operational indicators." },
  "/risk-intelligence": { title: "Risk Intelligence", purpose: "Ranks districts, stations, and crime types by operational risk and suggested action priority." },
  "/ai-insights": { title: "AI Insights", purpose: "Explains uploaded crime data using AI-style insights and recommendations." },
  "/ai-report": { title: "AI Report Generator", purpose: "Creates a professional police intelligence report from uploaded crime records." },
  "/reports": { title: "Reports", purpose: "Stores and previews generated intelligence reports." },
  "/presentation-mode": { title: "Presentation Mode", purpose: "Shows the project in a judge-friendly briefing format." },
  "/risk-intelligence-center": { title: "Risk Intelligence Center", purpose: "Compare districts and police stations, understand risk profiles, and prioritize action." },
  "/alerts-patterns": { title: "Alerts & Pattern Detection", purpose: "Detect urgent red-zone signals, repeated patterns, and emerging crime behavior." },
  "/crime-trend-hotspot": { title: "Crime Trend & Hotspot Explorer", purpose: "Explore where crime is concentrated, how it changes over time, and what future risks may emerge." },
  "/reports-briefing": { title: "Reports & AI Briefing", purpose: "Generate, view, download, print, and manage intelligence reports." }
};

export const ModulePurpose = ({ pathname }: { pathname: string }) => {
  const guide = moduleGuidance[pathname];
  if (!guide) return null;
  return (
    <section className="card-safe mb-6 flex items-start gap-3 border border-command-500/30 bg-command-500/5 px-4 py-3 shadow-glow" aria-label={`What ${guide.title} does`}>
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-command-300" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-command-300">What this module does</p>
        <p className="mt-1 text-safe text-sm text-slate-300">{guide.purpose}</p>
      </div>
    </section>
  );
};

type JourneyStep = {
  step: number;
  title: string;
  description: string;
  to: string;
  action: string;
  icon: LucideIcon;
};

const journeySteps: JourneyStep[] = [
  { step: 1, title: "Upload Crime Data", description: "Import FIR/crime CSV records into the system.", to: "/upload", action: "Go to Upload", icon: UploadCloud },
  { step: 2, title: "View Command Dashboard", description: "See total crimes, districts, stations, categories, and data quality.", to: "/dashboard", action: "Open Dashboard", icon: CheckCircle2 },
  { step: 3, title: "Check Alerts & Pattern Detection", description: "Identify urgent red-zone signals and hidden crime patterns.", to: "/alerts-patterns", action: "View Signals", icon: Siren },
  { step: 4, title: "Explore Crime Trends & Hotspots", description: "Use the map, timeline, and forecast to understand where and when risk changes.", to: "/crime-trend-hotspot", action: "Open Explorer", icon: MapPinned },
  { step: 5, title: "Open Risk Intelligence Center", description: "Compare district and station risk before prioritizing action.", to: "/risk-intelligence-center", action: "Open Risk Center", icon: TimerReset },
  { step: 6, title: "Generate Intelligence Report", description: "Create a professional report with findings and recommendations.", to: "/reports-briefing", action: "Generate Report", icon: FileText }
];

export const GuidedJourney = ({ canAccessRoute }: { canAccessRoute?: (route: string) => boolean }) => {
  const steps = journeySteps.filter((item) => !canAccessRoute || canAccessRoute(item.to));
  return (
    <section className="card-safe border border-command-700 bg-command-900/85 p-5 shadow-glow">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">CrimePulse AI Guided Journey</p>
        <h2 className="mt-1 text-xl font-semibold text-white">From uploaded records to actionable intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Follow these steps to understand how uploaded crime records become actionable police intelligence.</p>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map(({ step, title, description, to, action, icon: Icon }) => (
          <li key={to} className="card-safe flex min-w-0 flex-col border border-command-700 bg-command-850 p-4">
            <div className="flex items-center justify-between gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-command-300/50 bg-command-500/10 text-xs font-bold text-command-300">{step}</span><Icon className="h-5 w-5 shrink-0 text-command-300" aria-hidden="true" /></div>
            <h3 className="mt-4 text-safe text-sm font-semibold text-white">{title}</h3>
            <p className="mt-2 flex-1 text-safe text-sm leading-5 text-slate-400">{description}</p>
            <Link className="mt-4 inline-flex min-h-10 items-center gap-2 self-start text-sm font-semibold text-command-300 hover:text-white" to={to}>{action}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const RecommendedNextStep = ({ title, description, to, action }: { title: string; description: string; to: string; action: string }) => (
  <section className="card-safe flex flex-col justify-between gap-4 border border-command-300/45 bg-command-500/10 p-5 shadow-glow sm:flex-row sm:items-center">
    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Next recommended step</p><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2><p className="mt-1 text-safe text-sm text-slate-300">{description}</p></div>
    <Link className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to={to}>{action}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
  </section>
);
