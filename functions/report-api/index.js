const catalyst = require("zcatalyst-sdk-node");
const { applyFilters, fetchCrimeRecords, filterOptions, getDashboardSummary, getMonthlyTrend, hasCoordinates, isHeinous, recommendedAction, topN, toNumber } = require("./crimeAnalytics");

const SERVICE_NAME = "report-api";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CRIME_TABLE = process.env.CRIME_TABLE || process.env.CRIME_RECORDS_TABLE || "CrimeRecords";
const PAGE_SIZE = 200;
const AVAILABLE_ROUTES = ["GET /", "GET /health", "GET /report/summary", "GET /report/filters", "GET /report/generate", "POST /report/generate", "GET /report/preview", "POST /report/preview", "POST /reports/generate", "GET /reports/recent"];
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

const unwrapRows = (result) => Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.rows) ? result.rows : [];
const rowValue = (row, key) => row?.[key] ?? row?.[CRIME_TABLE]?.[key] ?? row?.CrimeRecords?.[key] ?? "";
const normalizeRow = (row) => ({
  crime_id: String(rowValue(row, "crime_id") || ""), district: String(rowValue(row, "district") || ""), police_station: String(rowValue(row, "police_station") || ""), crime_type: String(rowValue(row, "crime_type") || ""), crime_subtype: String(rowValue(row, "crime_subtype") || ""), severity: String(rowValue(row, "severity") || "Low"), severity_original: String(rowValue(row, "severity_original") || ""), fir_year: String(rowValue(row, "fir_year") || ""), fir_month: String(rowValue(row, "fir_month") || ""), fir_stage: String(rowValue(row, "fir_stage") || ""), complaint_mode: String(rowValue(row, "complaint_mode") || ""), latitude_value: String(rowValue(row, "latitude_value") || ""), longitude_value: String(rowValue(row, "longitude_value") || ""), victim_count: toNumber(rowValue(row, "victim_count")), accused_count: toNumber(rowValue(row, "accused_count")), arrested_count: toNumber(rowValue(row, "arrested_count")), conviction_count: toNumber(rowValue(row, "conviction_count"))
});

async function fetchAllCrimeRecords(app) {
  const rows = [];
  let offset = 0;
  try {
    while (true) {
      const page = unwrapRows(await app.zcql().executeZCQLQuery(`SELECT * FROM ${CRIME_TABLE} LIMIT ${PAGE_SIZE} OFFSET ${offset}`));
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rows.map(normalizeRow);
  } catch (error) {
    console.warn("[report-api] paginated ZCQL fetch failed", error.message);
    return fetchCrimeRecords(app, { limit: 5000 });
  }
}

function firstNumber(value) {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return Number(value.flat(Infinity).find((item) => Number.isFinite(Number(item))) || 0);
  if (typeof value === "object") return firstNumber(Object.values(value));
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

async function safeStoredCount(app, fallback) {
  try {
    const rows = await app.zcql().executeZCQLQuery("SELECT COUNT(ROWID) FROM CrimeRecords");
    return rows[0] ? firstNumber(rows[0]) : fallback;
  } catch (error) {
    console.warn("[report-api] count query failed; using fetched record count", error.message);
    return fallback;
  }
}

function compactSummary(records, filters = {}) {
  const summary = getDashboardSummary(records);
  const accused = records.reduce((sum, row) => sum + toNumber(row.accused_count), 0);
  const arrested = records.reduce((sum, row) => sum + toNumber(row.arrested_count), 0);
  const convictions = records.reduce((sum, row) => sum + toNumber(row.conviction_count), 0);
  return {
    filters,
    total_records: records.length,
    districts_covered: new Set(records.map((row) => row.district).filter(Boolean)).size,
    police_stations_covered: new Set(records.map((row) => row.police_station).filter(Boolean)).size,
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
    top_crime_head: topN(records, "crime_subtype", 1)[0]?.name || "No data",
    top_district: topN(records, "district", 1)[0]?.name || "No data",
    top_station: topN(records, "police_station", 1)[0]?.name || "No data"
  };
}

function reportText(summary, reportType = "full-intelligence-report") {
  const executive = `CrimePulse AI analyzed ${summary.total_records.toLocaleString()} FIR/crime records. ${summary.top_district} contributed the highest record volume in the selected dataset, with ${summary.top_station} showing the highest police-station-level concentration. ${summary.top_crime} was the dominant crime group. ${summary.coordinate_available_percentage < 40 ? "Coordinate availability is limited; hotspot analysis should use district-level fallback where required." : "Coordinate availability is sufficient for spatial review in the selected scope."}`;
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

function renderTable(title, rows) {
  const safeRows = rows.length ? rows : [{ name: "No data", value: 0 }];
  return `<div class="table-block"><h3>${esc(title)}</h3><table><thead><tr><th>Rank</th><th>Category</th><th>Records</th></tr></thead><tbody>${safeRows.slice(0, 5).map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td>${Number(row.value || row.count || 0).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>`;
}

function badgeFor(value) {
  const text = String(value || "Low");
  const level = text.toLowerCase().includes("critical") ? "critical" : text.toLowerCase().includes("high") ? "high" : text.toLowerCase().includes("medium") ? "medium" : "low";
  return `<span class="badge badge-${level}">${esc(text)}</span>`;
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
  const reportTitle = body.title || body.report_title || "CrimePulse AI Intelligence Report";
  const kpis = [
    ["Records Analyzed", summary.total_records.toLocaleString()], ["Districts Covered", summary.districts_covered.toLocaleString()], ["Police Stations", summary.police_stations_covered.toLocaleString()], ["Dominant Crime Type", summary.top_crime], ["Heinous Crimes", summary.heinous_count.toLocaleString()], ["Non-Heinous Crimes", summary.non_heinous_count.toLocaleString()], ["Convictions", summary.conviction_count.toLocaleString()], ["Coordinate Availability", `${summary.coordinate_available_percentage}%`]
  ];
  const tableHtml = `${renderTable("Top Districts", summary.district_ranking)}${renderTable("Top Police Stations", summary.police_station_ranking)}${renderTable("Top Crime Types", summary.crime_type_distribution)}${renderTable("FIR Stage Distribution", summary.fir_stage_distribution)}`;
  const recommendationHtml = text.recommendations.map((item, index) => `<div class="recommendation-card"><div><strong>Priority ${index + 1}</strong> ${badgeFor(index === 0 ? "High" : "Medium")}</div><p><strong>Action:</strong> ${esc(item)}</p><p><strong>Reason:</strong> Based on volume, concentration, legal resolution, and coordinate-readiness indicators in the selected records.</p><p><strong>Expected impact:</strong> Improved prevention focus, investigation follow-up, and operational deployment.</p></div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportTitle)}</title><style>
    *{box-sizing:border-box} body{font-family:Inter,Arial,sans-serif;background:#f4f7fb;color:#111827;margin:0;padding:32px;line-height:1.6}.report-container{max-width:1100px;margin:0 auto;background:#fff;padding:42px;border-radius:18px;box-shadow:0 12px 35px rgba(15,23,42,.12)}.report-header{border-bottom:4px solid #2563eb;padding-bottom:24px;margin-bottom:28px}.report-kicker{text-transform:uppercase;letter-spacing:3px;color:#2563eb;font-size:12px;font-weight:700}.report-title{font-size:32px;color:#0f172a;margin:8px 0}.report-subtitle{color:#475569;font-size:15px}.meta-grid,.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}.meta-card,.kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.kpi-grid{gap:14px;margin:24px 0}.kpi-label{font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:1px}.kpi-value{font-size:20px;font-weight:800;color:#0f172a;margin-top:6px;overflow-wrap:anywhere}.summary-box{background:linear-gradient(135deg,#eff6ff,#f8fafc);border-left:5px solid #2563eb;padding:20px;border-radius:12px;margin:22px 0}.report-section{margin-top:32px;padding-top:22px;border-top:1px solid #e5e7eb;page-break-inside:avoid}.section-heading{display:flex;align-items:center;gap:12px;color:#0f172a;font-size:22px;margin:0 0 10px}.section-number{background:#2563eb;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}.table-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.table-block h3{font-size:15px;color:#0f172a;margin:0 0 6px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}th{background:#0f172a;color:#fff;text-align:left;padding:12px}td{border:1px solid #e5e7eb;padding:11px}tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}.badge-high{background:#ffedd5;color:#c2410c}.badge-medium{background:#fef9c3;color:#a16207}.badge-low{background:#dcfce7;color:#15803d}.badge-critical{background:#fee2e2;color:#b91c1c}.recommendation-card{border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;padding:16px;margin:12px 0}.recommendation-card p{margin:8px 0}.footer{margin-top:40px;padding-top:18px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px}@media(max-width:760px){body{padding:0}.report-container{padding:24px;border-radius:0}.meta-grid,.kpi-grid,.table-grid{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff;padding:0}.report-container{box-shadow:none;border-radius:0;max-width:none}.report-section{page-break-inside:avoid}.no-print{display:none!important}}
  </style></head><body><main class="report-container"><header class="report-header"><p class="report-kicker">Karnataka Police | Crime Intelligence</p><h1 class="report-title">${esc(reportTitle)}</h1><p class="report-subtitle">AI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police</p><div class="meta-grid"><div class="meta-card"><div class="kpi-label">Generated</div><strong>${new Date().toLocaleString()}</strong></div><div class="meta-card"><div class="kpi-label">Report Type</div><strong>${esc(reportType)}</strong></div><div class="meta-card"><div class="kpi-label">Records Analyzed</div><strong>${summary.total_records.toLocaleString()}</strong></div><div class="meta-card"><div class="kpi-label">AI Mode</div><strong>${esc(GEMINI_API_KEY ? "Gemini" : "Rule-based fallback")}</strong></div></div></header><section class="summary-box"><h2>Executive Summary</h2><p>${esc(text.executive)}</p></section><section class="kpi-grid">${kpis.map(([label,value]) => `<div class="kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div></div>`).join("")}</section>${sections.filter((item) => item.title !== "Cover Title" && item.title !== "Executive Summary").map((item,index) => `<section class="report-section"><h2 class="section-heading"><span class="section-number">${String(index + 1).padStart(2,"0")}</span>${esc(item.title)}</h2><p>${esc(item.body)}</p>${item.title === "Crime Volume Summary" || item.title === "District Risk Summary" || item.title === "Crime Type Analysis" || item.title === "FIR Stage and Complaint Mode Analysis" ? `<div class="table-grid">${tableHtml}</div>` : ""}${item.title === "Recommendations" ? recommendationHtml : ""}</section>`).join("")}<footer class="footer">${esc(DISCLAIMER)}</footer></main></body></html>`;
  const markdownTables = `| Top District | Records |\n|---|---:|\n${summary.district_ranking.slice(0,5).map((row) => `| ${row.name} | ${row.value} |`).join("\n")}\n\n| Top Police Station | Records |\n|---|---:|\n${summary.police_station_ranking.slice(0,5).map((row) => `| ${row.name} | ${row.value} |`).join("\n")}`;
  const markdown = `# ${reportTitle}\n\n**CrimePulse AI Intelligence Report**  \nAI-Powered Crime Intelligence & Predictive Risk Dashboard for Karnataka Police  \nGenerated: ${new Date().toISOString()}  \nRecords analyzed: ${summary.total_records}  \nAI mode: ${GEMINI_API_KEY ? "Gemini" : "Rule-based fallback"}\n\n## Executive Summary\n\n${text.executive}\n\n## KPI Summary\n\n- Districts covered: ${summary.districts_covered}\n- Police stations covered: ${summary.police_stations_covered}\n- Dominant crime type: ${summary.top_crime}\n- Heinous crimes: ${summary.heinous_count}\n- Non-heinous crimes: ${summary.non_heinous_count}\n- Coordinate availability: ${summary.coordinate_available_percentage}%\n\n${sections.filter((item) => item.title !== "Cover Title" && item.title !== "Executive Summary").map((item) => `## ${item.title}\n\n${item.body}`).join("\n\n")}\n\n## Ranking Tables\n\n${markdownTables}\n\n## Recommendations\n\n${text.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Disclaimer\n\n${DISCLAIMER}`;
  return {
    report_id: `RPT-${Date.now()}`,
    report_type: reportType,
    title: reportTitle,
    report_title: reportTitle,
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
      report_title: reportTitle,
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
    const allRecords = await fetchAllCrimeRecords(app);
    const totalRecords = await safeStoredCount(app, allRecords.length);
    if (req.method === "GET" && path === "/reports/recent") return send(res, 200, { success: true, data: [] });
    if (req.method === "GET" && path === "/report/summary") return send(res, 200, { success: true, data: { total_records: totalRecords, records_analyzed: totalRecords, available_report_types: ["executive-summary", "district-report", "risk-report", "hotspot-report", "forecast-report", "full-intelligence-report"], ai_mode: GEMINI_API_KEY ? "Gemini" : "Rule-based fallback", coordinate_available_percentage: pct(allRecords.filter(hasCoordinates).length, allRecords.length), generated_at: new Date().toISOString(), status: "ready" } });
    if (req.method === "GET" && path === "/report/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });
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
