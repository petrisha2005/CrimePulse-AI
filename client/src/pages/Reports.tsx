import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileBarChart, FileText, Loader2, Printer, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { AnimatedEmptyState, MotionCard, MotionSection } from "../components/animation";
import { useAuth } from "../auth/AuthContext";
import { getScopeLabel } from "../auth/accessScope";
import { crimeService } from "../services/crimeService";
import { reportService, type ReportSummary } from "../services/reportService";
import type { GeneratedReportResponse, ReportRequest } from "../types/crime";
import { downloadReportPdf, reportDownloadFilename } from "../utils/reportPdf";

const HISTORY_KEY = "crimepulse_generated_reports";
const reportTemplates = [
  { type: "executive-summary", title: "Executive Summary Report", description: "Short leadership briefing with key findings, top risk areas and actions.", sections: "Executive summary, scope, findings, actions" },
  { type: "full-intelligence-report", title: "Full Intelligence Report", description: "Comprehensive operational report across all analytics dimensions.", sections: "Dashboard, risk, alerts, trends, geo, case progress" },
  { type: "district-report", title: "District Risk Report", description: "District and station risk analysis for deployment planning.", sections: "District scope, station ranking, severity, actions" },
  { type: "red-zone-alerts-report", title: "Red-Zone Alerts Report", description: "Urgent anomaly and red-zone operational response report.", sections: "Alerts, anomalies, spike evidence, priority actions" },
  { type: "hotspot-map-report", title: "Hotspot Map Report", description: "Geo-intelligence report with coordinate coverage and fallback mapping.", sections: "Geo coverage, hotspots, clusters, map limitations" },
  { type: "crime-trend-forecast-report", title: "Crime Trend & Forecast Report", description: "Time trend and forecast planning report.", sections: "Year trend, month trend, peak periods, prevention" },
  { type: "fir-stage-case-progress-report", title: "FIR Stage / Case Progress Report", description: "Investigation progress and resolution-gap report.", sections: "FIR stage, arrests, convictions, follow-up" }
];

type StoredReport = GeneratedReportResponse & { ai_mode?: string };

const getCount = (response: { totalRecords?: number; data?: { totalRecords?: number } }) => response.totalRecords ?? response.data?.totalRecords ?? 0;

const readHistory = (): StoredReport[] => {
  try {
    const value = localStorage.getItem(HISTORY_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const printReport = (report: StoredReport) => {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(report.html);
  win.document.close();
  win.focus();
  win.print();
};

const Reports = () => {
  const { currentUser, scopeParams, preferences, hasPermission } = useAuth();
  const selectedReportRef = useRef<HTMLDivElement | null>(null);
  const [storedCount, setStoredCount] = useState(0);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [history, setHistory] = useState<StoredReport[]>([]);
  const [selected, setSelected] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState("");
  const [pdfMessage, setPdfMessage] = useState("");
  const [error, setError] = useState("");

  const lastGenerated = useMemo(() => history[0] || null, [history]);

  const load = async () => {
    setLoading(true);
    setError("");
    setHistory(readHistory());
    try {
      const countResponse = await crimeService.getCrimeCount();
      setStoredCount(getCount(countResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Endpoint: /server/crime-api/crimes/count failed.");
    }
    try {
      setSummary(await reportService.getSummary());
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Endpoint: /server/report-api/report/summary failed.";
      setError((current) => current ? `${current} | ${detail}` : detail);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveReport = (report: GeneratedReportResponse) => {
    const stored: StoredReport = { ...report, ai_mode: summary?.ai_mode || "Rule-based fallback" };
    const next = [stored, ...history.filter((item) => item.report_id !== stored.report_id)].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    setSelected(stored);
  };

  const generate = async (reportType: string) => {
    try {
      setGenerating(reportType);
      setError("");
      const scopedTitle = currentUser?.accessScope.type === "station"
        ? `${currentUser.assignedPoliceStation} Station Risk Report`
        : currentUser?.accessScope.type === "district"
          ? `${currentUser.assignedDistrict} District Intelligence Report`
          : reportTemplates.find((item) => item.type === reportType)?.title;
      const payload: ReportRequest = { report_type: reportType, report_title: scopedTitle, filters: scopeParams, sections: [] };
      saveReport(await reportService.generate(payload));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Endpoint: /server/report-api/report/generate failed.";
      setError(storedCount > 0 ? `${storedCount.toLocaleString()} records found, but Report API failed. ${detail}` : detail);
    } finally { setGenerating(""); }
  };

  const removeReport = (reportId: string) => {
    const next = history.filter((item) => item.report_id !== reportId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    if (selected?.report_id === reportId) setSelected(null);
  };

  const handleDownloadPdf = async (report: StoredReport) => {
    try {
      setPdfGenerating(report.report_id);
      setPdfMessage("Generating PDF...");
      await downloadReportPdf(report);
      setPdfMessage("PDF downloaded successfully.");
    } catch (err) {
      console.error("[Reports] PDF generation failed", err);
      setPdfMessage("PDF generation failed. Please use Print Report as fallback.");
    } finally {
      setPdfGenerating("");
    }
  };

  if (loading) return <StateBlock title="Loading Reports Center" message="Retrieving cached report summary if available." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-sm uppercase tracking-[0.18em] text-command-300">CrimePulse AI Reports Center</p><h1 className="text-3xl font-semibold text-white">Reports</h1><p className="mt-2 text-sm text-slate-400">View generated intelligence reports, quick summaries, and export-ready crime analysis documents.</p><p className="mt-2 text-xs font-semibold text-command-300">{getScopeLabel(currentUser)} · Default format: {preferences?.reportFormat || "full-intelligence-report"}</p></div>
        <button className="flex min-h-11 items-center gap-2 border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={load} type="button"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <section className="border border-command-500/40 bg-command-500/10 p-5 shadow-glow"><div className="flex items-center gap-3"><FileBarChart className="h-5 w-5 text-command-300" /><div><h2 className="font-semibold text-white">Data Status</h2><p className="mt-1 text-sm text-slate-300">{storedCount.toLocaleString()} crime records available for report generation.</p></div></div></section>

      {error && <div className="border border-alert-high/40 bg-command-900 p-4 text-sm text-alert-high"><p className="font-semibold">Reports module failed to load.</p><p className="mt-2 break-words">{error}</p><button className="mt-3 underline" onClick={load} type="button">Retry</button></div>}

      <div className="stat-grid">
        <DashboardCard title="Records Analyzed" value={(summary?.records_analyzed ?? storedCount).toLocaleString()} icon={FileText} />
        <DashboardCard title="Report Types" value={summary?.available_report_types.length || reportTemplates.length} icon={FileBarChart} />
        <DashboardCard title="AI Mode" value={summary?.ai_mode || "Rule-based fallback"} icon={Sparkles} tone="orange" />
        <DashboardCard title="Last Generated" value={lastGenerated ? new Date(lastGenerated.generated_at).toLocaleDateString() : "None yet"} icon={RefreshCw} />
        <DashboardCard title="Data Quality" value={`${summary?.coordinate_available_percentage ?? 0}% geo`} icon={ShieldCheck} tone="green" />
        <DashboardCard title="Export Options" value="HTML / MD / PDF" icon={Download} />
      </div>

      <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Quick Report Actions</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{reportTemplates.map((template) => <button key={template.type} disabled={Boolean(generating) || !hasPermission("GENERATE_REPORTS")} className="flex min-h-16 items-center justify-center gap-2 border border-command-700 bg-command-850 px-3 text-sm font-semibold text-slate-200 hover:border-command-300 hover:text-white disabled:opacity-60" onClick={() => generate(template.type)} type="button">{generating === template.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{generating === template.type ? "Generating..." : `Generate ${template.title}`}</button>)}</div></section>

      <section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Report Templates</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reportTemplates.map((template) => <article key={template.type} className="border border-command-700 bg-command-850 p-4"><h3 className="font-semibold text-white">{template.title}</h3><p className="mt-2 text-sm text-slate-400">{template.description}</p><p className="mt-3 text-xs text-command-300">Includes: {template.sections}</p><button className="mt-4 flex min-h-10 items-center gap-2 bg-command-500 px-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:opacity-60" disabled={Boolean(generating) || !hasPermission("GENERATE_REPORTS")} onClick={() => generate(template.type)} type="button">{generating === template.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Generate</button></article>)}</div></section>

      <MotionSection><section className="border border-command-700 bg-command-900/85 p-5 shadow-glow"><h2 className="font-semibold text-white">Generated Reports History</h2>{history.length === 0 ? <AnimatedEmptyState icon="📋" title="No Reports Generated Yet" description="Generate your first AI intelligence report from the AI Report Generator" /> : <div className="mt-4 space-y-3">{history.map((item, index) => <MotionCard key={item.report_id} delay={Math.min(index, 10) * 50} glowColor="cyan"><article className="grid gap-3 border border-command-700 bg-command-850 p-4 md:grid-cols-[1fr_auto]"><div><h3 className="font-semibold text-white">{item.title}</h3><p className="mt-2 font-mono text-[11px] text-slate-500">{item.meta?.reportTypeLabel || item.report_type} · {new Date(item.generated_at).toLocaleString()} · {item.records_analyzed.toLocaleString()} records</p></div><div className="flex flex-wrap gap-2"><button title="View report" className="text-command-300 hover:text-white" onClick={() => setSelected(item)} type="button"><Eye className="h-4 w-4" /></button><button title="Download HTML" className="text-command-300 hover:text-white" onClick={() => downloadText(reportDownloadFilename(item, "html"), item.html, "text/html")} type="button"><Download className="h-4 w-4" /></button><button title="Print report" className="text-command-300 hover:text-white" onClick={() => printReport(item)} type="button"><Printer className="h-4 w-4" /></button><button title="Delete report" className="text-alert-critical hover:text-white" onClick={() => removeReport(item.report_id)} type="button"><Trash2 className="h-4 w-4" /></button></div></article></MotionCard>)}</div>}</section></MotionSection>

      {selected && <section className="card-safe border border-command-700 bg-command-900/85 p-5 shadow-glow"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><p className="text-sm uppercase tracking-[0.16em] text-command-300">Report Preview</p><h2 className="text-safe mt-1 text-2xl font-semibold text-white">{selected.title}</h2><p className="text-safe mt-1 text-sm text-slate-400">Generated {new Date(selected.generated_at).toLocaleString()} | {selected.records_analyzed.toLocaleString()} records | {selected.meta?.reportTypeLabel || selected.report_type}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button className="bg-command-500 px-3 py-2 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:cursor-wait disabled:opacity-70" disabled={pdfGenerating === selected.report_id} onClick={() => handleDownloadPdf(selected)} type="button">{pdfGenerating === selected.report_id ? "Generating PDF..." : "Download PDF"}</button><button className="border border-command-700 px-3 py-2 text-sm text-slate-200 hover:bg-command-850" onClick={() => downloadText(reportDownloadFilename(selected, "html"), selected.html, "text/html")} type="button">Download HTML</button><button className="border border-command-700 px-3 py-2 text-sm text-slate-200 hover:bg-command-850" onClick={() => downloadText(reportDownloadFilename(selected, "md"), selected.markdown, "text/markdown")} type="button">Download Markdown</button><button className="border border-command-700 px-3 py-2 text-sm text-slate-200 hover:bg-command-850" onClick={() => printReport(selected)} type="button">Print Report</button><button className="border border-command-700 px-3 py-2 text-sm text-slate-200 hover:bg-command-850" onClick={() => setSelected(null)} type="button">Close</button></div></div>{pdfMessage && <p className={`mt-3 text-sm ${pdfMessage.includes("failed") ? "text-alert-high" : "text-command-300"}`}>{pdfMessage}</p>}<div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="text-safe"><h3 className="font-semibold text-white">Key Findings</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{selected.key_findings.map((finding) => <li key={finding}>- {finding}</li>)}</ul></div><div className="text-safe"><h3 className="font-semibold text-white">Recommendations</h3><ul className="mt-3 space-y-2 text-sm text-command-300">{selected.recommendations.map((item) => <li key={item}>- {item}</li>)}</ul></div></div><div className="report-preview mt-5 max-h-[760px] overflow-auto border border-slate-200 bg-white p-6 text-slate-950"><div ref={selectedReportRef} className="report-print-content prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: selected.html }} /></div></section>}
    </div>
  );
};

export default Reports;
