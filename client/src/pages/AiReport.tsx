import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, Printer, RefreshCw, Search, ShieldCheck, Target } from "lucide-react";
import StateBlock from "../components/StateBlock";
import { MotionButton, MotionSection } from "../components/animation";
import { useAuth } from "../auth/AuthContext";
import { crimeService } from "../services/crimeService";
import { reportService, type ReportSummary } from "../services/reportService";
import type { DashboardFilterOptions, GeneratedReportResponse, ReportFilters, ReportRequest } from "../types/crime";
import { downloadReportPdf, reportDownloadFilename } from "../utils/reportPdf";

const reportTypes = [
  { value: "executive-summary", label: "Executive Summary Report", description: "Short leadership briefing with dataset scope, key findings, top risk areas, and recommended actions." },
  { value: "full-intelligence-report", label: "Full Intelligence Report", description: "Complete operational report covering distribution, risk, alerts, patterns, trends, geo coverage, case progress, and limitations." },
  { value: "district-report", label: "District Risk Report", description: "District and police-station risk report focused on volume, severity, crime types, and district-level actions." },
  { value: "red-zone-alerts-report", label: "Red-Zone Alerts Report", description: "Urgent anomaly and red-zone report focused on high-risk locations, spike signals, and operational response." },
  { value: "hotspot-map-report", label: "Hotspot Map Report", description: "Geo-intelligence report explaining coordinate coverage, fallback mapping, hotspots, and map limitations." },
  { value: "crime-trend-forecast-report", label: "Crime Trend & Forecast Report", description: "Time-based report covering year/month trends, peak periods, category movement, and preventive planning." },
  { value: "fir-stage-case-progress-report", label: "FIR Stage / Case Progress Report", description: "Case progress report focused on FIR stages, arrests, convictions, resolution gaps, and follow-up actions." }
];

const sectionOptions = [
  "Executive Summary",
  "Dataset Overview",
  "District and Police Station Risk",
  "Crime Type and Crime Head Analysis",
  "FIR Stage and Complaint Mode Signals",
  "Arrest and Conviction Gap",
  "Data Quality Notes",
  "Recommended Police Actions"
];

const DEFAULT_REPORT_TYPE = "full-intelligence-report";

const DEFAULT_REPORT_FILTERS: ReportFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All"
};

const DEFAULT_REPORT_SECTIONS = [...sectionOptions];

const emptyOptions: DashboardFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const cleanFilters = (filters: ReportFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value && String(value).toLowerCase() !== "all")) as ReportFilters;

const getCount = (body: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  body.totalRecords ?? body.data?.totalRecords ?? 0;

const SelectFilter = ({ label, value, options, onChange, locked = false }: { label: string; value?: string; options: string[]; onChange: (value: string) => void; locked?: boolean }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    <span className="flex items-center gap-2">{label}{locked && <span className="normal-case tracking-normal text-command-300">Locked by role</span>}</span>
    <select aria-label={label} className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300 disabled:cursor-not-allowed disabled:opacity-70" disabled={locked} value={value || "All"} onChange={(event) => onChange(event.target.value)}>
      <option value="All">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const printReport = (report: GeneratedReportResponse) => {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return;
  printWindow.document.write(report.html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const AiReport = () => {
  const { scopeParams } = useAuth();
  const reportPreviewRef = useRef<HTMLDivElement | null>(null);
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions>(emptyOptions);
  const [request, setRequest] = useState<ReportRequest>({
    report_type: DEFAULT_REPORT_TYPE,
    report_title: "",
    filters: { ...DEFAULT_REPORT_FILTERS },
    sections: [...DEFAULT_REPORT_SECTIONS]
  });
  const [report, setReport] = useState<GeneratedReportResponse | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [storedCount, setStoredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");

  const activeFilters = useMemo(() => cleanFilters(request.filters), [request.filters]);
  const hasFilters = Object.keys(activeFilters).length > 0;
  const districtLocked = Boolean(scopeParams.district);
  const policeStationLocked = Boolean(scopeParams.police_station);
  const selectedReportType = reportTypes.find((type) => type.value === request.report_type) || reportTypes[1];

  const loadMeta = async () => {
    setApiError("");
    try {
      const countResponse = await crimeService.getCrimeCount();
      setStoredCount(getCount(countResponse));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Crime count API failed.");
    }

    const [summaryResult, filtersResult] = await Promise.allSettled([reportService.getSummary(), reportService.getFilters()]);
    if (summaryResult.status === "fulfilled") setReportSummary(summaryResult.value);
    if (filtersResult.status === "fulfilled") setFilterOptions({ ...emptyOptions, ...filtersResult.value });
    const failed = [summaryResult, filtersResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setApiError(failed.reason instanceof Error ? failed.reason.message : "Report API metadata failed.");
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    setRequest((current) => ({
      ...current,
      filters: { ...current.filters, ...scopeParams }
    }));
  }, [scopeParams.district, scopeParams.police_station]);

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    if ((key === "district" && districtLocked) || (key === "police_station" && policeStationLocked)) return;
    setRequest((current) => ({ ...current, filters: { ...current.filters, [key]: value, ...scopeParams } }));
  };

  const toggleSection = (section: string) => {
    setRequest((current) => ({
      ...current,
      sections: current.sections.includes(section)
        ? current.sections.filter((item) => item !== section)
        : [...current.sections, section]
    }));
  };

  const buildPayload = (): ReportRequest => ({
    ...request,
    filters: cleanFilters({ ...request.filters, ...scopeParams })
  });

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setError("");
      setReport(await reportService.preview(buildPayload()));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Report preview failed.";
      setError(storedCount > 0 ? `${storedCount.toLocaleString()} records found, but report module failed. ${message}` : message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setReport(await reportService.generate(buildPayload()));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Report generation failed.";
      setError(storedCount > 0 ? `${storedCount.toLocaleString()} records found, but report module failed. ${message}` : message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (currentReport: GeneratedReportResponse) => {
    try {
      setPdfGenerating(true);
      setPdfMessage("Generating PDF...");
      await downloadReportPdf(currentReport);
      setPdfMessage("PDF downloaded successfully.");
    } catch (err) {
      console.error("[AI Report] PDF generation failed", err);
      setPdfMessage("PDF generation failed. Please use Print Report as fallback.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleClearFilters = () => {
    setRequest({
      report_type: DEFAULT_REPORT_TYPE,
      report_title: "",
      filters: { ...DEFAULT_REPORT_FILTERS, ...scopeParams },
      sections: [...DEFAULT_REPORT_SECTIONS]
    });
    setReport(null);
    setError("");
    setApiError("");
    setLoading(false);
    setPreviewing(false);
    setPdfGenerating(false);
    setPdfMessage("");
    void loadMeta();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">CrimePulse AI Report Generator</p>
          <h1 className="text-3xl font-semibold text-white">AI Report</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Generate concise intelligence reports from stored Catalyst `CrimeRecords` summaries. Gemini is optional; rule-based report generation remains available.</p>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={loadMeta} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500/50 bg-command-850">
              <FileText className="h-5 w-5 text-command-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Report Scope</h2>
              <p className="text-sm text-slate-400">{storedCount.toLocaleString()} stored records available. {hasFilters ? "Filtered report scope active." : "Showing all records."}</p>
            </div>
          </div>
          <div className="rounded border border-command-300/30 bg-command-500/10 px-3 py-2 text-xs text-command-300">
            {reportSummary?.ai_mode === "Gemini" ? "Gemini-enhanced report generation active." : "Rule-based report generation active. Gemini is optional."}
          </div>
        </div>
      </section>

      {apiError && <div className="rounded border border-alert-high/40 bg-command-900 p-4 text-sm text-alert-high">{storedCount > 0 ? `${storedCount.toLocaleString()} records found, but report API failed.` : "Report API failed."} Details: {apiError}</div>}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Report Builder</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Report Type
            <select className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={request.report_type} onChange={(event) => setRequest((current) => ({ ...current, report_type: event.target.value }))}>
              {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Report Title
            <input className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={request.report_title || ""} onChange={(event) => setRequest((current) => ({ ...current, report_title: event.target.value }))} placeholder="Optional report title" />
          </label>
          <SelectFilter label="FIR Year" value={request.filters.fir_year} options={filterOptions.years} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={request.filters.fir_month} options={filterOptions.months} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="District" value={request.filters.district} options={filterOptions.districts} locked={districtLocked} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={request.filters.police_station} options={filterOptions.policeStations} locked={policeStationLocked} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={request.filters.crime_type} options={filterOptions.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={request.filters.severity} options={filterOptions.severities} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={request.filters.fir_stage} options={filterOptions.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>

        <div className="text-safe mt-4 rounded-md border border-command-500/30 bg-command-500/10 p-4 text-sm leading-6 text-slate-300">
          <span className="font-semibold text-command-300">{selectedReportType.label}: </span>
          {selectedReportType.description}
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Report Sections</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {sectionOptions.map((section) => (
              <label key={section} className="flex items-center gap-2 rounded border border-command-700 bg-command-850 px-3 py-2 text-sm text-slate-300">
                <input className="h-4 w-4 accent-command-300" checked={request.sections.includes(section)} onChange={() => toggleSection(section)} type="checkbox" />
                {section}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={handleClearFilters} type="button">
            <Target className="h-4 w-4" />
            Clear Filters
          </button>
          <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800 disabled:opacity-60" disabled={previewing || loading} onClick={handlePreview} type="button">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {previewing ? "Building Preview..." : "Preview Report"}
          </button>
          <MotionButton disabled={loading || previewing} onClick={handleGenerate}>{loading ? <span className="report-generating">GENERATING<span><i/> <i/> <i/></span></span> : <><Search className="h-4 w-4" />Generate Report</>}</MotionButton>
        </div>
      </section>

      {error && <StateBlock title={storedCount > 0 ? "Records found, but report module failed." : "Report generation unavailable"} message={error} />}

      {!report && !error && (
        <StateBlock title="No report generated yet" message="Choose a report type and generate a preview from stored Catalyst CrimeRecords data." />
      )}

      {report && (
        <>
          <MotionSection><section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow report-reveal-section">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-command-300">Generated Intelligence Report</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{report.title}</h2>
                <p className="mt-1 text-sm text-slate-400">Generated {new Date(report.generated_at).toLocaleString()} from {report.records_analyzed.toLocaleString()} records</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="flex min-h-10 items-center gap-2 rounded-md bg-command-500 px-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:cursor-wait disabled:opacity-70" disabled={pdfGenerating} onClick={() => handleDownloadPdf(report)} type="button">
                  {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pdfGenerating ? "Generating PDF..." : "Download PDF"}
                </button>
                <MotionButton variant="ghost" onClick={() => downloadText(reportDownloadFilename(report, "html"), report.html, "text/html")}><Download className="h-4 w-4" />Download HTML</MotionButton>
                <button className="flex min-h-10 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => downloadText(reportDownloadFilename(report, "md"), report.markdown, "text/markdown")} type="button">
                  <Download className="h-4 w-4" />
                  Markdown
                </button>
                <button className="flex min-h-10 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => printReport(report)} type="button">
                  <Printer className="h-4 w-4" />
                  Print Report
                </button>
              </div>
            </div>
            {pdfMessage && <p className={`mt-3 text-sm ${pdfMessage.includes("failed") ? "text-alert-high" : "text-command-300"}`}>{pdfMessage}</p>}
          </section></MotionSection>

          <MotionSection delay={200}><section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow report-reveal-section">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-command-300" />
                <h2 className="text-base font-semibold text-white">Key Findings</h2>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {report.key_findings.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow report-reveal-section">
              <h2 className="text-base font-semibold text-white">Recommendations</h2>
              <ul className="mt-4 space-y-2 text-sm text-command-300">
                {report.recommendations.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </section></MotionSection>

          <MotionSection delay={400}><section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow report-reveal-section">
            <h2 className="text-base font-semibold text-white">White Paper Preview</h2>
            <div className="mt-4 max-h-[760px] overflow-auto rounded-md border border-slate-200 bg-white p-6 text-slate-950 shadow-xl">
              <div ref={reportPreviewRef} className="report-print-content prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: report.html }} />
            </div>
          </section></MotionSection>
        </>
      )}
    </div>
  );
};

export default AiReport;
