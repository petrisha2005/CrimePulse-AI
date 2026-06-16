const catalyst = require("zcatalyst-sdk-node");
const { applyFilters, fetchCrimeRecords, filterOptions, getDashboardSummary, getMonthlyTrend, hasCoordinates, isHeinous, recommendedAction, topN, toNumber } = require("./crimeAnalytics");

const SERVICE_NAME = "report-api";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AVAILABLE_ROUTES = ["GET /", "GET /health", "GET /report/summary", "GET /report/generate", "POST /report/generate", "GET /report/preview", "POST /report/preview", "POST /reports/generate", "GET /reports/recent"];
const DISCLAIMER = "This report is generated from uploaded FIR/crime records. Forecasts and risk scores are decision-support indicators, not guaranteed predictions.";
const CORS_HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

function send(res, statusCode, data) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(data));
}

function getPath(req, serviceName) {
  const rawUrl = req.url || "/";
  const urlOnly = rawUrl.split("?")[0];
  return urlOnly.replace(`/server/${serviceName}`, "").replace(new RegExp(`^/${serviceName}`), "").replace(/\/+$/, "") || "/";
}

function getQuery(req) {
  return Object.fromEntries(new URL(req.url || "/", `https://${req.headers.host || "catalyst.local"}`).searchParams.entries());
}

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk.toString(); });
  req.on("end", () => {
    try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
  });
});

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

function compactSummary(records, filters = {}) {
  const summary = getDashboardSummary(records);
  const accused = records.reduce((sum, row) => sum + toNumber(row.accused_count), 0);
  const arrested = records.reduce((sum, row) => sum + toNumber(row.arrested_count), 0);
  const convictions = records.reduce((sum, row) => sum + toNumber(row.conviction_count), 0);
  return {
    filters,
    total_records: records.length,
    district_ranking: topN(records, "district", 10),
    police_station_ranking: topN(records, "police_station", 10),
    crime_type_distribution: topN(records, "crime_type", 10),
    crime_head_distribution: topN(records, "crime_subtype", 10),
    heinous_count: records.filter(isHeinous).length,
    non_heinous_count: Math.max(records.length - records.filter(isHeinous).length, 0),
    fir_stage_distribution: topN(records, "fir_stage", 10),
    complaint_mode_distribution: topN(records, "complaint_mode", 10),
    victim_count: summary.totalVictims,
    accused_count: accused,
    arrested_count: arrested,
    conviction_count: convictions,
    arrest_rate: pct(arrested, accused),
    conviction_rate: pct(convictions, accused),
    coordinate_available_percentage: pct(records.filter(hasCoordinates).length, records.length),
    monthly_trend: getMonthlyTrend(records).slice(-12),
    top_crime: topN(records, "crime_type", 1)[0]?.name || "No data",
    top_district: topN(records, "district", 1)[0]?.name || "No data",
    top_station: topN(records, "police_station", 1)[0]?.name || "No data"
  };
}

function reportText(summary, reportType = "full-intelligence-report") {
  const executive = `CrimePulse AI analyzed ${summary.total_records} FIR/crime records. ${summary.top_district} is the top district by volume, ${summary.top_station} is the leading police station signal, and ${summary.top_crime} is the dominant crime type.`;
  const keyFindings = [
    `Total records analyzed: ${summary.total_records}`,
    `Top district: ${summary.top_district}`,
    `Top police station: ${summary.top_station}`,
    `Dominant crime type: ${summary.top_crime}`,
    `Heinous/high-severity records: ${summary.heinous_count}`,
    `Coordinate availability: ${summary.coordinate_available_percentage}%`,
    `Conviction rate: ${summary.conviction_rate}%`
  ];
  const recommendations = [
    recommendedAction(summary.top_crime),
    "Review high-volume districts and police stations for targeted deployment.",
    summary.conviction_rate < 10 ? "Strengthen evidence tracking and case follow-up." : "Continue monitoring legal resolution flow.",
    summary.coordinate_available_percentage < 40 ? "Improve FIR geotagging for better hotspot readiness." : "Maintain coordinate capture quality."
  ];
  return { executive, keyFindings, recommendations, reportType };
}

function section(title, body) {
  return { title, body };
}

function buildReport(records, body = {}) {
  const reportType = body.report_type || "full-intelligence-report";
  const summary = compactSummary(records, body.filters || body);
  const text = reportText(summary, reportType);
  const sections = [
    section("Cover Title", "CrimePulse AI - AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police"),
    section("Executive Summary", text.executive),
    section("Dataset Overview", `${summary.total_records} records analyzed with ${summary.coordinate_available_percentage}% coordinate availability.`),
    section("Crime Volume Summary", `Top districts: ${summary.district_ranking.slice(0, 5).map((i) => `${i.name} (${i.value})`).join(", ")}.`),
    section("District Risk Summary", `${summary.top_district} shows the highest record volume in the selected scope.`),
    section("Crime Type Analysis", `Dominant crime type is ${summary.top_crime}. Top crime heads: ${summary.crime_head_distribution.slice(0, 5).map((i) => i.name).join(", ")}.`),
    section("Police Station Concentration", `${summary.top_station} is the leading police station signal.`),
    section("Heinous vs Non-Heinous Analysis", `${summary.heinous_count} heinous/high records and ${summary.non_heinous_count} non-heinous/other records.`),
    section("FIR Stage and Complaint Mode Analysis", `Top FIR stages: ${summary.fir_stage_distribution.slice(0, 5).map((i) => i.name).join(", ")}. Top complaint modes: ${summary.complaint_mode_distribution.slice(0, 5).map((i) => i.name).join(", ")}.`),
    section("Victim, Accused, Arrest, Conviction Summary", `Victims: ${summary.victim_count}, accused: ${summary.accused_count}, arrests: ${summary.arrested_count}, convictions: ${summary.conviction_count}.`),
    section("Hotspot and Coordinate Readiness", `Coordinate availability is ${summary.coordinate_available_percentage}%.`),
    section("Forecast and Emerging Risk Signals", "Forecast signals are rule-based indicators from historical FIR month trends and concentration patterns."),
    section("AI Insights", `Main operational gap: ${summary.conviction_rate < 10 ? "legal resolution gap" : "district and police station concentration"}.`),
    section("Recommendations", text.recommendations.join(" ")),
    section("Data Quality Notes", summary.coordinate_available_percentage < 40 ? "Location capture should be improved." : "Coordinate readiness is acceptable for selected records."),
    section("Disclaimer", DISCLAIMER)
  ];
  const html = `<article style="font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6"><h1>${esc(body.report_title || "CrimePulse AI Intelligence Report")}</h1><p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>${sections.map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join("")}</article>`;
  const markdown = `# ${body.report_title || "CrimePulse AI Intelligence Report"}\n\nGenerated: ${new Date().toISOString()}\n\n${sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n")}`;
  return {
    report_id: `RPT-${Date.now()}`,
    report_type: reportType,
    title: body.report_title || "CrimePulse AI Intelligence Report",
    report_title: body.report_title || "CrimePulse AI Intelligence Report",
    generated_at: new Date().toISOString(),
    records_analyzed: records.length,
    sections,
    html,
    markdown,
    key_findings: text.keyFindings,
    recommendations: text.recommendations,
    ai_mode: GEMINI_API_KEY ? "Gemini" : "Rule-based fallback",
    preview: {
      report_id: `RPT-${Date.now()}`,
      report_title: body.report_title || "CrimePulse AI Intelligence Report",
      report_type: reportType,
      generated_at: new Date().toISOString(),
      filters: body.filters || body,
      executive_summary: text.executive,
      key_findings: text.keyFindings,
      charts_summary: { district_ranking: summary.district_ranking, crime_type_distribution: summary.crime_type_distribution, monthly_trend: summary.monthly_trend },
      risk_districts: summary.district_ranking.slice(0, 5),
      anomalies: [`${summary.top_district} has highest volume.`],
      forecast: "Rule-based historical forecast indicators included.",
      recommendations: text.recommendations,
      ai_note: GEMINI_API_KEY ? "Gemini polishing available." : "Rule-based report generated because GEMINI_API_KEY is not configured."
    },
    download_url: ""
  };
}

module.exports = async (req, res) => {
  const path = getPath(req, SERVICE_NAME);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI report-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (req.method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });
  try {
    const app = catalyst.initialize(req);
    const allRecords = await fetchCrimeRecords(app);
    if (req.method === "GET" && path === "/reports/recent") return send(res, 200, { success: true, data: [] });
    if (req.method === "GET" && path === "/report/summary") return send(res, 200, { success: true, data: { total_records: allRecords.length, records_analyzed: allRecords.length, available_report_types: ["executive-summary", "district-report", "risk-report", "hotspot-report", "forecast-report", "full-intelligence-report"], ai_mode: GEMINI_API_KEY ? "Gemini" : "Rule-based fallback", generated_at: new Date().toISOString() } });
    if ((req.method === "GET" && (path === "/report/preview" || path === "/report/generate")) || (req.method === "POST" && (path === "/report/preview" || path === "/report/generate" || path === "/reports/generate"))) {
      const body = req.method === "POST" ? await readJsonBody(req) : getQuery(req);
      const filters = body.filters || body;
      const records = applyFilters(allRecords, filters);
      if (!records.length) return send(res, 200, { success: true, data: null, message: "No crime data available for selected filters." });
      const report = buildReport(records, body);
      report.download_url = `/server/report-api/report/generate?report_id=${encodeURIComponent(report.report_id)}`;
      return send(res, 200, { success: true, data: report });
    }
    return send(res, 404, { success: false, message: "Route not found", path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[report-api] request failed", error);
    return send(res, 500, { success: false, message: "Report API failed", error: error.message, details: error.toString(), path, stack: error.stack });
  }
};
