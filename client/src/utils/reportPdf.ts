import html2pdf from "html2pdf.js";
import type { GeneratedReportResponse } from "../types/crime";

export const safeReportFilePart = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

export const reportDownloadFilename = (report: GeneratedReportResponse, extension: "pdf" | "html" | "md") => {
  const date = new Date(report.generated_at).toISOString().slice(0, 10);
  const label = safeReportFilePart(report.meta?.reportTypeLabel || report.report_type || "CrimePulse_Report");
  return `CrimePulse_${label}_${date}.${extension}`;
};

export const downloadReportPdf = async (report: GeneratedReportResponse, filename = reportDownloadFilename(report, "pdf")) => {
  const wrapper = document.createElement("div");
  wrapper.className = "report-pdf-export-host";
  wrapper.innerHTML = report.html;
  document.body.appendChild(wrapper);

  const reportContent = (wrapper.querySelector(".report-container") || wrapper) as HTMLElement;
  reportContent.classList.add("report-print-content");

  try {
    const worker = html2pdf() as {
      set: (options: Record<string, unknown>) => {
        from: (source: HTMLElement) => { save: () => Promise<void> };
      };
    };

    await worker
      .set({
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: [".report-section", ".kpi-card", ".meta-card", ".recommendation-card", "tr"] }
      })
      .from(reportContent)
      .save();
  } finally {
    wrapper.remove();
  }
};
