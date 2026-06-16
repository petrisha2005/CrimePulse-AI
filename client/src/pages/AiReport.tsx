import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Loader2, Printer, RefreshCw, Search, ShieldCheck, Target } from "lucide-react";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { dashboardService } from "../services/dashboardService";
import { reportService } from "../services/reportService";
import type { DashboardFilterOptions, GeneratedReportResponse, ReportFilters, ReportRequest } from "../types/crime";

const reportTypes = [
  { value: "executive-summary", label: "Executive Summary" },
  { value: "district-report", label: "District Report" },
  { value: "risk-report", label: "Risk Report" },
  { value: "hotspot-report", label: "Hotspot Report" },
  { value: "forecast-report", label: "Forecast Report" },
  { value: "full-intelligence-report", label: "Full Intelligence Report" }
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

const allFilters: ReportFilters = {
  fir_year: "All",
  fir_month: "All",
  district: "All",
  police_station: "All",
  crime_type: "All",
  severity: "All",
  fir_stage: "All"
};

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

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={value || "All"} onChange={(event) => onChange(event.target.value)}>
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
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions>(emptyOptions);
  const [request, setRequest] = useState<ReportRequest>({
    report_type: "full-intelligence-report",
    report_title: "",
    filters: allFilters,
    sections: sectionOptions
  });
  const [report, setReport] = useState<GeneratedReportResponse | null>(null);
  const [storedCount, setStoredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");

  const activeFilters = useMemo(() => cleanFilters(request.filters), [request.filters]);
  const hasFilters = Object.keys(activeFilters).length > 0;

  const loadMeta = async () => {
    try {
      const [countResponse, filtersResponse] = await Promise.all([
        crimeService.getCrimeCount(),
        dashboardService.getFilters()
      ]);
      setStoredCount(getCount(countResponse));
      setFilterOptions({ ...emptyOptions, ...filtersResponse.data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report metadata.");
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setRequest((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
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
    filters: activeFilters
  });

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setError("");
      const response = await reportService.preview(buildPayload());
      if (!response.data) {
        setError("No crime records found for the selected report filters.");
        return;
      }
      setReport(response.data);
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
      const response = await reportService.generate(buildPayload());
      if (!response.data) {
        setError("No crime records found for the selected report filters.");
        return;
      }
      setReport(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Report generation failed.";
      setError(storedCount > 0 ? `${storedCount.toLocaleString()} records found, but report module failed. ${message}` : message);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setRequest((current) => ({ ...current, filters: allFilters }));
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
            Output includes HTML, Markdown, and browser Print / Save as PDF.
          </div>
        </div>
      </section>

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
          <SelectFilter label="District" value={request.filters.district} options={filterOptions.districts} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={request.filters.police_station} options={filterOptions.policeStations} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={request.filters.crime_type} options={filterOptions.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={request.filters.severity} options={filterOptions.severities} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={request.filters.fir_stage} options={filterOptions.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
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
          <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={clearFilters} type="button">
            <Target className="h-4 w-4" />
            Clear Filters
          </button>
          <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800 disabled:opacity-60" disabled={previewing || loading} onClick={handlePreview} type="button">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {previewing ? "Building Preview..." : "Preview Report"}
          </button>
          <button className="flex min-h-11 items-center gap-2 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:opacity-60" disabled={loading || previewing} onClick={handleGenerate} type="button">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </section>

      {error && <StateBlock title={storedCount > 0 ? "Records found, but report module failed." : "Report generation unavailable"} message={error} />}

      {!report && !error && (
        <StateBlock title="No report generated yet" message="Choose a report type and generate a preview from stored Catalyst CrimeRecords data." />
      )}

      {report && (
        <>
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-command-300">Generated Intelligence Report</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{report.title}</h2>
                <p className="mt-1 text-sm text-slate-400">Generated {new Date(report.generated_at).toLocaleString()} from {report.records_analyzed.toLocaleString()} records</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="flex min-h-10 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => downloadText(`${report.report_id}.html`, report.html, "text/html")} type="button">
                  <Download className="h-4 w-4" />
                  HTML
                </button>
                <button className="flex min-h-10 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => downloadText(`${report.report_id}.md`, report.markdown, "text/markdown")} type="button">
                  <Download className="h-4 w-4" />
                  Markdown
                </button>
                <button className="flex min-h-10 items-center gap-2 rounded-md bg-command-500 px-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => printReport(report)} type="button">
                  <Printer className="h-4 w-4" />
                  Print / PDF
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-command-300" />
                <h2 className="text-base font-semibold text-white">Key Findings</h2>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {report.key_findings.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <h2 className="text-base font-semibold text-white">Recommendations</h2>
              <ul className="mt-4 space-y-2 text-sm text-command-300">
                {report.recommendations.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </section>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">White Paper Preview</h2>
            <div className="mt-4 max-h-[760px] overflow-auto rounded-md border border-slate-200 bg-white p-6 text-slate-950 shadow-xl">
              <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: report.html }} />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AiReport;
