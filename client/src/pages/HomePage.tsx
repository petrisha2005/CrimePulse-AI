import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  FileText,
  LockKeyhole,
  Map,
  MapPinned,
  Radar,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { Link } from "react-router-dom";
import IntelligenceBackground from "../components/home/IntelligenceBackground";

const capabilities = [
  { title: "Upload Crime Data", description: "Bring structured FIR and crime records into a secure Catalyst-backed command environment.", icon: UploadCloud },
  { title: "Command Dashboard", description: "See key trends, records, district coverage, and operational context in one focused view.", icon: BarChart3 },
  { title: "District Risk DNA", description: "Build explainable district intelligence profiles for informed resource planning.", icon: ShieldCheck },
  { title: "Red-Zone Alerts", description: "Detect unusual spikes, concentrations, and emerging operational patterns.", icon: Radar },
  { title: "Pattern Discovery", description: "Surface recurring crime types, temporal shifts, and station-level concentrations.", icon: BrainCircuit },
  { title: "Hotspot Map", description: "Translate stored crime records into a clear spatial intelligence view.", icon: Map },
  { title: "Crime Time Machine", description: "Move through historical periods to understand how activity changes over time.", icon: Activity },
  { title: "Forecast & AI Insights", description: "Support proactive decisions with trend signals, forecasts, and intelligence reports.", icon: Sparkles }
];

const workflow = [
  "Upload FIR / Crime CSV data",
  "Clean and store records securely",
  "Generate dashboards and hotspot maps",
  "Detect anomalies and patterns",
  "Forecast risks and generate reports",
  "Support police decision-making"
];

const trustPoints = ["Role-Based Secure Access", "Data-Driven Intelligence", "Hotspot Detection", "Predictive Analytics", "AI Report Generation", "Scalable for Large FIR Datasets"];

const HeroCommandPreview = () => (
  <aside className="hero-command-preview landing-reveal landing-reveal-delay-2" aria-label="Crime intelligence visual preview">
    <div className="hero-preview-header"><span className="hero-preview-led" /><span>CRIMEPULSE INTELLIGENCE LAYER</span><span className="hero-preview-lock"><LockKeyhole className="h-3.5 w-3.5" /> SECURE</span></div>
    <div className="hero-preview-map">
      <div className="hero-map-grid" />
      <div className="hero-map-route hero-map-route-a" /><div className="hero-map-route hero-map-route-b" /><div className="hero-map-route hero-map-route-c" />
      <div className="hero-map-node hero-map-node-a" /><div className="hero-map-node hero-map-node-b" /><div className="hero-map-node hero-map-node-c" /><div className="hero-map-node hero-map-node-d" />
      <div className="hero-map-sweep" />
      <div className="hero-map-label">DISTRICT NETWORK</div>
    </div>
    <div className="hero-preview-bottom">
      <div className="hero-preview-trace"><span>INTELLIGENCE TRACE</span><svg viewBox="0 0 270 62" role="img" aria-label="Decorative predictive trend trace"><path d="M0 48 C28 45, 32 25, 60 32 S88 49, 115 22 S145 16, 170 30 S207 46, 232 19 S250 12, 270 16" /></svg></div>
      <div className="hero-preview-panel"><MapPinned className="h-5 w-5 text-command-300" /><span>Spatial intelligence</span></div>
      <div className="hero-preview-panel"><BrainCircuit className="h-5 w-5 text-command-300" /><span>Pattern reasoning</span></div>
    </div>
  </aside>
);

const HomePage = () => (
  <main className="landing-page landing-premium min-h-screen overflow-hidden bg-command-950 text-slate-100">
    <IntelligenceBackground />

    <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <Link className="flex min-w-0 items-center gap-3" to="/"><span className="landing-brand-mark grid h-11 w-11 shrink-0 place-items-center"><ShieldCheck className="h-6 w-6 text-command-200" /></span><span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Karnataka Police</span><span className="block truncate text-lg font-semibold text-white">CrimePulse AI</span></span></Link>
      <Link className="landing-login-link" to="/login">Login <ArrowRight className="h-4 w-4" /></Link>
    </nav>

    <section className="relative z-10 mx-auto grid min-h-[72vh] max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:pb-28 lg:pt-20">
      <div className="landing-reveal">
        <p className="landing-eyebrow"><Sparkles className="h-4 w-4" /> Secure Crime Intelligence Platform</p>
        <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">CrimePulse <span className="text-command-300">AI</span></h1>
        <p className="mt-6 max-w-3xl text-xl font-medium leading-8 text-command-100 sm:text-2xl">AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police</p>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Transform crime records into actionable intelligence through hotspot detection, temporal analysis, explainable risk signals, alerts, forecasting, and decision support.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link className="landing-primary-cta" to="/login"><LockKeyhole className="h-4 w-4" />Login to Command Center</Link><a className="landing-secondary-cta" href="#how-it-works">View Demo Journey <ArrowRight className="h-4 w-4" /></a></div>
        <div className="landing-security-row mt-9"><ShieldCheck className="h-4 w-4 text-command-300" /><span>Role-aware access and scoped intelligence views</span><span className="hidden h-1 w-1 rounded-full bg-command-500 sm:block" /><span className="hidden sm:inline">Built for data-informed policing</span></div>
      </div>
      <HeroCommandPreview />
    </section>

    <section className="landing-band relative z-10 border-y border-command-700/60 px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="landing-section-heading"><p>Platform Capabilities</p><h2>One intelligence surface. Eight focused capabilities.</h2><span>CrimePulse AI converts stored records into explainable, operationally useful views without turning the public experience into a dashboard.</span></div><div className="mt-11 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{capabilities.map(({ title, description, icon: Icon }, index) => <article key={title} className="landing-capability landing-reveal" style={{ animationDelay: `${index * 55}ms` }}><span className="landing-capability-icon"><Icon className="h-5 w-5" /></span><h3>{title}</h3><p>{description}</p><span className="landing-capability-line" /></article>)}</div></div></section>

    <section id="how-it-works" className="relative z-10 px-4 py-24 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="landing-section-heading text-center"><p>How It Works</p><h2>From raw records to operational clarity.</h2><span>A deliberate workflow designed to keep the data journey understandable from intake through action.</span></div><div className="landing-workflow mt-14">{workflow.map((step, index) => <article key={step} className="landing-workflow-step"><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p>{index < workflow.length - 1 && <i aria-hidden="true" />}</article>)}</div></div></section>

    <section className="landing-band relative z-10 border-y border-command-700/60 px-4 py-24 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-2"><article className="landing-story-panel landing-reveal"><p className="landing-panel-kicker">Why It Matters</p><h2>Large crime datasets do not become intelligence on their own.</h2><ul><li>Manual review makes temporal shifts and risk clusters difficult to see.</li><li>Delayed interpretation limits the time available for preventive action.</li><li>District and station comparison needs context, not just a spreadsheet total.</li></ul></article><article className="landing-story-panel landing-story-solution landing-reveal landing-reveal-delay-1"><p className="landing-panel-kicker">The CrimePulse Approach</p><h2>Explainable intelligence for planning and response.</h2><ul><li>Convert raw records into structured dashboards, maps, and timelines.</li><li>Connect patterns, concentrations, forecasts, and actions in one workflow.</li><li>Support officer judgment with transparent data signals and reports.</li></ul></article></div></section>

    <section className="relative z-10 px-4 py-24 sm:px-6 lg:px-8"><div className="landing-media-strip mx-auto max-w-7xl"><div className="landing-media-copy"><p className="landing-panel-kicker">Intelligence Infrastructure</p><h2>Built to feel like a secure command environment.</h2><p>Spatial networks, temporal traces, and secure system patterns create an interface for investigation and planning, without exposing sensitive operational detail on the public site.</p><Link className="landing-inline-link" to="/login">Enter the secure command center <ArrowRight className="h-4 w-4" /></Link></div><div className="landing-media-graphic" aria-hidden="true"><div className="landing-media-orbit" /><div className="landing-media-grid" /><div className="landing-media-wave"><span /><span /><span /></div><div className="landing-media-marker landing-media-marker-a" /><div className="landing-media-marker landing-media-marker-b" /><div className="landing-media-marker landing-media-marker-c" /></div></div></section>

    <section className="landing-trust-section relative z-10 border-y border-command-700/60 px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="landing-section-heading"><p>Trust & Deployment</p><h2>Designed for responsible crime intelligence workflows.</h2></div><div className="mt-10 flex flex-wrap gap-3">{trustPoints.map((point) => <span key={point} className="landing-trust-badge"><ShieldCheck className="h-4 w-4" />{point}</span>)}</div></div></section>

    <footer className="relative z-10 px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-command-700/60 pt-8 text-sm sm:flex-row sm:items-end"><div><p className="font-semibold text-white">CrimePulse AI</p><p className="mt-1 text-slate-500">Karnataka Police hackathon prototype · Decision support for crime analytics and operational planning.</p></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-slate-400"><a href="#how-it-works">Demo Journey</a><Link to="/login">Secure Login</Link><a href="#">Prototype Notice</a></div></div></footer>
  </main>
);

export default HomePage;
