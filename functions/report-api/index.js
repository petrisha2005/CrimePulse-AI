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
  return fetchCrimeRecords(app);
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
  const years = [...new Set(records.map((row) => String(row.fir_year || "").trim()).filter(Boolean))].sort();
  const recordsWithCoordinates = records.filter(hasCoordinates).length;
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
    records_with_coordinates: recordsWithCoordinates,
    records_without_coordinates: Math.max(records.length - recordsWithCoordinates, 0),
    coordinate_available_percentage: pct(recordsWithCoordinates, records.length),
    data_quality_score: pct(records.filter((row) => row.district && row.police_station && row.crime_type && row.fir_year && row.fir_month).length, records.length),
    year_range: years.length ? `${years[0]} - ${years[years.length - 1]}` : "No year data",
    monthly_trend: getMonthlyTrend(records).slice(-12),
    top_crime: topN(records, "crime_type", 1)[0]?.name || "No data",
    top_crime_head: topN(records, "crime_subtype", 1)[0]?.name || "No data",
    top_district: topN(records, "district", 1)[0]?.name || "No data",
    top_station: topN(records, "police_station", 1)[0]?.name || "No data"
  };
}

function section(title, body) {
  return { title, body };
}

function normalizeReportType(value) {
  const normalized = String(value || "full-intelligence-report").toLowerCase().trim();
  const aliases = {
    "executive": "executive-summary",
    "executive-summary-report": "executive-summary",
    "full-report": "full-intelligence-report",
    "full-intelligence": "full-intelligence-report",
    "district-risk-report": "district-report",
    "risk-report": "district-report",
    "red-zone-report": "red-zone-alerts-report",
    "alerts-report": "red-zone-alerts-report",
    "hotspot-report": "hotspot-map-report",
    "map-report": "hotspot-map-report",
    "forecast-report": "crime-trend-forecast-report",
    "trend-forecast-report": "crime-trend-forecast-report",
    "case-progress-report": "fir-stage-case-progress-report",
    "fir-stage-report": "fir-stage-case-progress-report"
  };
  return aliases[normalized] || normalized;
}

const REPORT_DEFINITIONS = {
  "executive-summary": {
    title: "Executive Summary Report",
    purpose: "For senior officers and quick leadership briefing.",
    tone: "Short, high-level, leadership-focused.",
    sections: ["Executive Summary", "Dataset Scope", "Key Findings", "Top Risk Areas", "Critical Crime Categories", "Recommended Actions", "Limitations / Data Quality Note"]
  },
  "full-intelligence-report": {
    title: "Full Intelligence Report",
    purpose: "Complete detailed operational intelligence report.",
    tone: "Detailed and structured.",
    sections: ["Executive Summary", "Dataset Overview", "Crime Distribution", "District and Station Risk Analysis", "Red-Zone Alerts", "Pattern Discovery", "Time Trend Analysis", "Hotspot / Geo Coverage Analysis", "FIR Stage and Case Progress Analysis", "Arrest and Conviction Gap", "Recommendations", "Data Quality and Limitations", "Disclaimer"]
  },
  "district-report": {
    title: "District Risk Report",
    purpose: "Analyze district and police station risk.",
    tone: "District command and deployment-focused.",
    sections: ["District Scope", "District Crime Volume", "Police Station Ranking", "Top Crime Types", "Severity Distribution", "High-Risk Stations", "Suggested District-Level Actions"]
  },
  "red-zone-alerts-report": {
    title: "Red-Zone Alerts Report",
    purpose: "Show urgent risk and anomaly signals.",
    tone: "Urgent operational response-focused.",
    sections: ["Alert Summary", "Red-Zone Locations", "Anomaly Detection Results", "High-Frequency Crime Types", "Current vs Historical Activity", "Suggested Operational Response", "Priority Action List"]
  },
  "hotspot-map-report": {
    title: "Hotspot Map Report",
    purpose: "Explain location-based crime intelligence.",
    tone: "Geo-readiness and hotspot interpretation-focused.",
    sections: ["Geo Intelligence Summary", "Coordinate Coverage", "Exact Coordinate Records", "Missing Coordinate Records", "Fallback Mapping Explanation", "Top Hotspot Areas", "Police Station Clusters", "Map Limitations", "Suggested Geo-Data Improvements"]
  },
  "crime-trend-forecast-report": {
    title: "Crime Trend & Forecast Report",
    purpose: "Show how crime changes over time.",
    tone: "Planning and prevention-focused.",
    sections: ["Trend Summary", "Year-wise Crime Trend", "Month-wise Crime Trend", "Peak Months", "Declining / Increasing Crime Categories", "Forecast Risk Signals", "Preventive Planning Suggestions"]
  },
  "fir-stage-case-progress-report": {
    title: "FIR Stage / Case Progress Report",
    purpose: "Analyze investigation progress and case closure.",
    tone: "Case progress and investigation follow-up-focused.",
    sections: ["FIR Stage Overview", "Pending Cases", "Closed / Completed Cases", "Arrest Count", "Conviction Count", "Resolution Gap", "Suggested Investigation Follow-Up"]
  }
};

function topListText(rows, label = "records") {
  const safeRows = rows.slice(0, 5);
  return safeRows.length ? safeRows.map((row, index) => `${index + 1}. ${row.name} (${Number(row.value || 0).toLocaleString()} ${label})`).join("; ") : "No data available.";
}

function filterScopeText(filters = {}, totalUploadedRecords = 0, recordsAnalyzed = 0) {
  const activeFilters = Object.entries(filters).filter(([, value]) => value && String(value).toLowerCase() !== "all");
  if (!activeFilters.length) return `Report generated for the full uploaded dataset: ${recordsAnalyzed.toLocaleString()} records analyzed from ${totalUploadedRecords.toLocaleString()} uploaded records.`;
  return `Report generated for filtered dataset: ${recordsAnalyzed.toLocaleString()} matching records from ${totalUploadedRecords.toLocaleString()} uploaded records. Filters: ${activeFilters.map(([key, value]) => `${key.replace(/_/g, " ")} = ${value}`).join(", ")}.`;
}

function buildAnomalySignals(summary) {
  const signals = [];
  if (summary.district_ranking[0]) signals.push(`${summary.district_ranking[0].name} is the leading red-zone location with ${summary.district_ranking[0].value.toLocaleString()} records.`);
  if (summary.police_station_ranking[0]) signals.push(`${summary.police_station_ranking[0].name} is the highest-volume police station signal.`);
  if (summary.heinous_count > 0) signals.push(`${summary.heinous_count.toLocaleString()} heinous/high-severity records require priority review.`);
  if (summary.conviction_rate < 10) signals.push(`Conviction rate is ${summary.conviction_rate}%, indicating a case-resolution follow-up gap.`);
  return signals.length ? signals : ["No major red-zone signals could be derived from the selected records."];
}

function buildYearlyTrend(records) {
  const map = new Map();
  records.forEach((row) => {
    const year = String(row.fir_year || "Unknown");
    map.set(year, (map.get(year) || 0) + 1);
  });
  return [...map.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([name, value]) => ({ name, value }));
}

function buildReportSections(reportType, summary, records, meta) {
  const scope = filterScopeText(summary.filters, meta.totalUploadedRecords, summary.total_records);
  const trendRows = buildYearlyTrend(records);
  const peakMonth = summary.monthly_trend.slice().sort((a, b) => Number(b.crimes || b.value || 0) - Number(a.crimes || a.value || 0))[0];
  const anomalySignals = buildAnomalySignals(summary);
  const common = {
    executive: `CrimePulse AI analyzed ${summary.total_records.toLocaleString()} FIR/crime records. ${summary.top_district} is the leading district signal, ${summary.top_station} is the leading police station signal, and ${summary.top_crime} is the dominant crime group in this scope.`,
    scope,
    topRisk: `Top districts: ${topListText(summary.district_ranking)} Top police stations: ${topListText(summary.police_station_ranking)}.`,
    crimeCategories: `Dominant crime type: ${summary.top_crime}. Top crime heads: ${topListText(summary.crime_head_distribution)}.`,
    geo: `Only ${summary.coordinate_available_percentage}% of records have exact coordinates. ${summary.records_without_coordinates.toLocaleString()} records without exact latitude/longitude should be represented using police station or district fallback mapping.`,
    caseProgress: `FIR stage distribution: ${topListText(summary.fir_stage_distribution)} Arrests: ${summary.arrested_count.toLocaleString()}, convictions: ${summary.conviction_count.toLocaleString()}, accused count: ${summary.accused_count.toLocaleString()}, conviction rate: ${summary.conviction_rate}%.`
  };
  const recommendations = buildRecommendations(reportType, summary);

  const sectionMap = {
    "executive-summary": [
      section("Executive Summary", common.executive),
      section("Dataset Scope", common.scope),
      section("Key Findings", [`Top district: ${summary.top_district}`, `Top police station: ${summary.top_station}`, `Dominant crime type: ${summary.top_crime}`, `Coordinate availability: ${summary.coordinate_available_percentage}%`].join(". ") + "."),
      section("Top Risk Areas", common.topRisk),
      section("Critical Crime Categories", `Heinous/high-severity records: ${summary.heinous_count.toLocaleString()}. ${common.crimeCategories}`),
      section("Recommended Actions", recommendations.join(" ")),
      section("Limitations / Data Quality Note", `${summary.data_quality_score}% data quality score. ${common.geo}`)
    ],
    "full-intelligence-report": [
      section("Executive Summary", common.executive),
      section("Dataset Overview", `${common.scope} Dataset covers ${summary.districts_covered.toLocaleString()} districts, ${summary.police_stations_covered.toLocaleString()} police stations, and year range ${summary.year_range}.`),
      section("Crime Distribution", `Top crime groups: ${topListText(summary.crime_type_distribution)} Top crime heads: ${topListText(summary.crime_head_distribution)}.`),
      section("District and Station Risk Analysis", common.topRisk),
      section("Red-Zone Alerts", anomalySignals.join(" ")),
      section("Pattern Discovery", `Crime concentration is led by ${summary.top_station}. ${summary.top_crime_head} is the highest-frequency crime head in the selected scope.`),
      section("Time Trend Analysis", `Year-wise trend: ${topListText(trendRows, "records")} Peak month signal: ${peakMonth ? `${peakMonth.month || peakMonth.name} (${peakMonth.crimes || peakMonth.value} records)` : "No monthly signal available"}.`),
      section("Hotspot / Geo Coverage Analysis", common.geo),
      section("FIR Stage and Case Progress Analysis", common.caseProgress),
      section("Arrest and Conviction Gap", `Arrest rate is ${summary.arrest_rate}% and conviction rate is ${summary.conviction_rate}%.`),
      section("Recommendations", recommendations.join(" ")),
      section("Data Quality and Limitations", `Coordinate coverage: ${summary.coordinate_available_percentage}%. Data quality score: ${summary.data_quality_score}%. Insights depend on uploaded CSV completeness.`),
      section("Disclaimer", DISCLAIMER)
    ],
    "district-report": [
      section("District Scope", `${common.scope} Leading district: ${summary.top_district}. Districts covered: ${summary.districts_covered}.`),
      section("District Crime Volume", `District ranking: ${topListText(summary.district_ranking)}.`),
      section("Police Station Ranking", `Police station ranking: ${topListText(summary.police_station_ranking)}.`),
      section("Top Crime Types", `Crime groups: ${topListText(summary.crime_type_distribution)} Crime heads: ${topListText(summary.crime_head_distribution)}.`),
      section("Severity Distribution", `${summary.heinous_count.toLocaleString()} heinous/high records and ${summary.non_heinous_count.toLocaleString()} non-heinous/other records.`),
      section("High-Risk Stations", `${summary.top_station} should be treated as the leading station-level concentration signal.`),
      section("Suggested District-Level Actions", recommendations.join(" "))
    ],
    "red-zone-alerts-report": [
      section("Alert Summary", `${summary.total_records.toLocaleString()} records analyzed. ${anomalySignals[0]}`),
      section("Red-Zone Locations", common.topRisk),
      section("Anomaly Detection Results", anomalySignals.join(" ")),
      section("High-Frequency Crime Types", `Dominant crime type is ${summary.top_crime}. Top crime groups: ${topListText(summary.crime_type_distribution)}.`),
      section("Current vs Historical Activity", `Recent monthly signals: ${summary.monthly_trend.slice(-6).map((item) => `${item.month || item.name}: ${item.crimes || item.value}`).join(", ") || "No month-wise trend available"}.`),
      section("Suggested Operational Response", recommendations.join(" ")),
      section("Priority Action List", `1. Review ${summary.top_district}. 2. Reassess deployment around ${summary.top_station}. 3. Monitor ${summary.top_crime}.`)
    ],
    "hotspot-map-report": [
      section("Geo Intelligence Summary", common.geo),
      section("Coordinate Coverage", `${summary.records_with_coordinates.toLocaleString()} records have exact coordinates. ${summary.records_without_coordinates.toLocaleString()} records are missing exact coordinates.`),
      section("Exact Coordinate Records", `${summary.records_with_coordinates.toLocaleString()} exact-coordinate records can support point-level map review.`),
      section("Missing Coordinate Records", `${summary.records_without_coordinates.toLocaleString()} records require fallback mapping or non-spatial district/station analysis.`),
      section("Fallback Mapping Explanation", "Records without exact latitude/longitude are represented using police station or district fallback locations so district-level analytics remain usable without pretending exact incident locations exist."),
      section("Top Hotspot Areas", common.topRisk),
      section("Police Station Clusters", `Highest cluster signal: ${summary.top_station}. Station ranking: ${topListText(summary.police_station_ranking)}.`),
      section("Map Limitations", `Coordinate availability is ${summary.coordinate_available_percentage}%, so spatial precision is limited by source CSV completeness.`),
      section("Suggested Geo-Data Improvements", recommendations.join(" "))
    ],
    "crime-trend-forecast-report": [
      section("Trend Summary", `Year range: ${summary.year_range}. Peak month: ${peakMonth ? `${peakMonth.month || peakMonth.name} with ${peakMonth.crimes || peakMonth.value} records` : "No monthly peak available"}.`),
      section("Year-wise Crime Trend", `Year-wise distribution: ${topListText(trendRows, "records")}.`),
      section("Month-wise Crime Trend", `Recent monthly records: ${summary.monthly_trend.map((item) => `${item.month || item.name}: ${item.crimes || item.value}`).join(", ") || "No monthly trend data available"}.`),
      section("Peak Months", peakMonth ? `${peakMonth.month || peakMonth.name} is the strongest period in the selected scope.` : "No peak month could be calculated."),
      section("Declining / Increasing Crime Categories", `${summary.top_crime} is the strongest continuing category signal. Review monthly shifts around this category before deployment planning.`),
      section("Forecast Risk Signals", "Forecast indicators are rule-based and derived from uploaded FIR year/month trends, dominant crime groups, and station concentration."),
      section("Preventive Planning Suggestions", recommendations.join(" "))
    ],
    "fir-stage-case-progress-report": [
      section("FIR Stage Overview", `FIR stage distribution: ${topListText(summary.fir_stage_distribution)}.`),
      section("Pending Cases", `Use FIR stage ranking to identify pending or investigation-heavy stages. Leading stage: ${summary.fir_stage_distribution[0]?.name || "No data"}.`),
      section("Closed / Completed Cases", `Closed/completed case signal depends on FIR stage values in the uploaded CSV. Current top stages: ${topListText(summary.fir_stage_distribution)}.`),
      section("Arrest Count", `${summary.arrested_count.toLocaleString()} arrests recorded against ${summary.accused_count.toLocaleString()} accused count.`),
      section("Conviction Count", `${summary.conviction_count.toLocaleString()} convictions recorded. Conviction rate: ${summary.conviction_rate}%.`),
      section("Resolution Gap", common.caseProgress),
      section("Suggested Investigation Follow-Up", recommendations.join(" "))
    ]
  };
  return sectionMap[reportType] || sectionMap["full-intelligence-report"];
}

function buildRecommendations(reportType, summary) {
  const baseAction = recommendedAction(summary.top_crime);
  const byType = {
    "executive-summary": [baseAction, `Prioritize command review for ${summary.top_district} and ${summary.top_station}.`, "Use this briefing to decide the next operational review meeting agenda."],
    "full-intelligence-report": [baseAction, "Coordinate district, station, FIR stage, and geo-data reviews in one operational cycle.", summary.conviction_rate < 10 ? "Strengthen evidence tracking and legal follow-up for low conviction conversion." : "Continue monitoring arrest-to-conviction conversion."],
    "district-report": [`Deploy district-level follow-up around ${summary.top_district}.`, `Review station load and patrol allocation for ${summary.top_station}.`, baseAction],
    "red-zone-alerts-report": [`Treat ${summary.top_district} and ${summary.top_station} as immediate red-zone review points.`, "Run station-level anomaly review before the next deployment cycle.", baseAction],
    "hotspot-map-report": [summary.coordinate_available_percentage < 50 ? "Improve FIR geotagging and station/district fallback validation." : "Maintain exact coordinate capture quality.", `Use ${summary.top_station} as the first station cluster for map validation.`, baseAction],
    "crime-trend-forecast-report": [`Track ${summary.top_crime} across the next reporting period.`, "Use monthly trend peaks for preventive patrol planning.", baseAction],
    "fir-stage-case-progress-report": [summary.conviction_rate < 10 ? "Strengthen investigation follow-up, evidence tracking, and case monitoring." : "Maintain case progress monitoring.", "Review FIR stage bottlenecks with station officers.", baseAction]
  };
  return byType[reportType] || byType["full-intelligence-report"];
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

function buildReport(records, body = {}, meta = {}) {
  const reportType = normalizeReportType(body.reportType || body.report_type || "full-intelligence-report");
  const definition = REPORT_DEFINITIONS[reportType] || REPORT_DEFINITIONS["full-intelligence-report"];
  const summary = compactSummary(records, body.filters || body);
  const sections = buildReportSections(reportType, summary, records, { totalUploadedRecords: meta.totalUploadedRecords || records.length });
  const executiveSection = sections.find((item) => item.title === "Executive Summary") || sections[0] || section("Executive Summary", "No summary available.");
  const recommendations = buildRecommendations(reportType, summary);
  const keyFindings = [
    `Records analyzed: ${summary.total_records.toLocaleString()} of ${(meta.totalUploadedRecords || summary.total_records).toLocaleString()} uploaded records`,
    `Top district: ${summary.top_district}`,
    `Top police station: ${summary.top_station}`,
    `Dominant crime type: ${summary.top_crime}`,
    `Coordinate availability: ${summary.coordinate_available_percentage}%`,
    `Conviction rate: ${summary.conviction_rate}%`
  ];
  const reportTitle = body.title || body.report_title || definition.title;
  const kpis = [
    ["Records Analyzed", summary.total_records.toLocaleString()], ["Districts Covered", summary.districts_covered.toLocaleString()], ["Police Stations", summary.police_stations_covered.toLocaleString()], ["Dominant Crime Type", summary.top_crime], ["Heinous Crimes", summary.heinous_count.toLocaleString()], ["Non-Heinous Crimes", summary.non_heinous_count.toLocaleString()], ["Data Quality", `${summary.data_quality_score}%`], ["Coordinate Availability", `${summary.coordinate_available_percentage}%`]
  ];
  const tableHtml = `${renderTable("Top Districts", summary.district_ranking)}${renderTable("Top Police Stations", summary.police_station_ranking)}${renderTable("Top Crime Types", summary.crime_type_distribution)}${renderTable("FIR Stage Distribution", summary.fir_stage_distribution)}`;
  const recommendationHtml = recommendations.map((item, index) => `<div class="recommendation-card"><div><strong>Priority ${index + 1}</strong> ${badgeFor(index === 0 ? "High" : "Medium")}</div><p><strong>Action:</strong> ${esc(item)}</p><p><strong>Reason:</strong> Based on ${esc(definition.purpose.toLowerCase())} and the uploaded dataset indicators.</p><p><strong>Expected impact:</strong> Improved prevention focus, investigation follow-up, and operational deployment.</p></div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportTitle)}</title><style>
    *{box-sizing:border-box} body{font-family:Inter,Arial,sans-serif;background:#f4f7fb;color:#111827;margin:0;padding:32px;line-height:1.6}.report-container{max-width:1100px;margin:0 auto;background:#fff;padding:42px;border-radius:18px;box-shadow:0 12px 35px rgba(15,23,42,.12)}.report-header{border-bottom:4px solid #2563eb;padding-bottom:24px;margin-bottom:28px}.report-kicker{text-transform:uppercase;letter-spacing:3px;color:#2563eb;font-size:12px;font-weight:700}.report-title{font-size:32px;color:#0f172a;margin:8px 0}.report-subtitle{color:#475569;font-size:15px}.meta-grid,.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}.meta-card,.kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.kpi-grid{gap:14px;margin:24px 0}.kpi-label{font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:1px}.kpi-value{font-size:20px;font-weight:800;color:#0f172a;margin-top:6px;overflow-wrap:anywhere}.summary-box{background:linear-gradient(135deg,#eff6ff,#f8fafc);border-left:5px solid #2563eb;padding:20px;border-radius:12px;margin:22px 0}.report-section{margin-top:32px;padding-top:22px;border-top:1px solid #e5e7eb;page-break-inside:avoid}.section-heading{display:flex;align-items:center;gap:12px;color:#0f172a;font-size:22px;margin:0 0 10px}.section-number{background:#2563eb;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}.table-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.table-block h3{font-size:15px;color:#0f172a;margin:0 0 6px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}th{background:#0f172a;color:#fff;text-align:left;padding:12px}td{border:1px solid #e5e7eb;padding:11px}tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}.badge-high{background:#ffedd5;color:#c2410c}.badge-medium{background:#fef9c3;color:#a16207}.badge-low{background:#dcfce7;color:#15803d}.badge-critical{background:#fee2e2;color:#b91c1c}.recommendation-card{border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;padding:16px;margin:12px 0}.recommendation-card p{margin:8px 0}.footer{margin-top:40px;padding-top:18px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px}@media(max-width:760px){body{padding:0}.report-container{padding:24px;border-radius:0}.meta-grid,.kpi-grid,.table-grid{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff;padding:0}.report-container{box-shadow:none;border-radius:0;max-width:none}.report-section{page-break-inside:avoid}.no-print{display:none!important}}
  </style></head><body><main class="report-container"><header class="report-header"><p class="report-kicker">Karnataka Police | Crime Intelligence</p><h1 class="report-title">${esc(reportTitle)}</h1><p class="report-subtitle">${esc(definition.title)} · ${esc(definition.purpose)}</p><div class="meta-grid"><div class="meta-card"><div class="kpi-label">Generated</div><strong>${new Date().toLocaleString()}</strong></div><div class="meta-card"><div class="kpi-label">Report Type</div><strong>${esc(definition.title)}</strong></div><div class="meta-card"><div class="kpi-label">Records Analyzed</div><strong>${summary.total_records.toLocaleString()}</strong></div><div class="meta-card"><div class="kpi-label">AI Mode</div><strong>${esc(GEMINI_API_KEY ? "Gemini AI" : "Rule engine")}</strong></div></div></header><section class="summary-box"><h2>${esc(executiveSection.title)}</h2><p>${esc(executiveSection.body)}</p></section><section class="kpi-grid">${kpis.map(([label,value]) => `<div class="kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div></div>`).join("")}</section>${sections.filter((item) => item !== executiveSection).map((item,index) => `<section class="report-section"><h2 class="section-heading"><span class="section-number">${String(index + 1).padStart(2,"0")}</span>${esc(item.title)}</h2><p>${esc(item.body)}</p>${["Crime Distribution","District and Station Risk Analysis","District Crime Volume","Police Station Ranking","Top Crime Types","Red-Zone Locations","Top Hotspot Areas","Police Station Clusters","FIR Stage Overview","Year-wise Crime Trend"].includes(item.title) ? `<div class="table-grid">${tableHtml}</div>` : ""}${item.title.toLowerCase().includes("recommend") || item.title.toLowerCase().includes("action") ? recommendationHtml : ""}</section>`).join("")}<footer class="footer">Generated by CrimePulse AI prototype. Insights are based on uploaded FIR/crime CSV data. Data quality depends on source CSV completeness. ${esc(DISCLAIMER)}</footer></main></body></html>`;
  const markdownTables = `| Top District | Records |\n|---|---:|\n${summary.district_ranking.slice(0,5).map((row) => `| ${row.name} | ${row.value} |`).join("\n")}\n\n| Top Police Station | Records |\n|---|---:|\n${summary.police_station_ranking.slice(0,5).map((row) => `| ${row.name} | ${row.value} |`).join("\n")}`;
  const markdown = `# ${reportTitle}\n\n**${definition.title}**  \nCrimePulse AI · Karnataka Police Crime Intelligence Report  \nGenerated: ${new Date().toISOString()}  \nRecords analyzed: ${summary.total_records} of ${meta.totalUploadedRecords || summary.total_records}  \nAI mode: ${GEMINI_API_KEY ? "Gemini AI" : "Rule engine"}\n\n${sections.map((item) => `## ${item.title}\n\n${item.body}`).join("\n\n")}\n\n## Ranking Tables\n\n${markdownTables}\n\n## Recommendations\n\n${recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Disclaimer\n\n${DISCLAIMER}`;
  const generatedAt = new Date().toISOString();
  return {
    report_id: `RPT-${reportType}-${Date.now()}`,
    report_type: reportType,
    title: reportTitle,
    report_title: reportTitle,
    generated_at: generatedAt,
    records_analyzed: records.length,
    sections,
    html,
    markdown,
    key_findings: keyFindings,
    recommendations,
    ai_mode: GEMINI_API_KEY ? "Gemini" : "Rule-based fallback",
    meta: {
      totalUploadedRecords: meta.totalUploadedRecords || records.length,
      recordsAnalyzed: records.length,
      reportType,
      reportTypeLabel: definition.title,
      appliedFilters: summary.filters,
      generatedAt,
      coordinateCoverage: summary.coordinate_available_percentage,
      dataQuality: summary.data_quality_score,
      isGeminiUsed: Boolean(GEMINI_API_KEY),
      isFallbackUsed: !GEMINI_API_KEY
    },
    preview: {
      report_id: `RPT-${Date.now()}`,
      report_title: reportTitle,
      report_type: reportType,
      generated_at: generatedAt,
      filters: body.filters || body,
      executive_summary: executiveSection.body,
      key_findings: keyFindings,
      charts_summary: { district_ranking: summary.district_ranking, crime_type_distribution: summary.crime_type_distribution, monthly_trend: summary.monthly_trend },
      risk_districts: summary.district_ranking.slice(0, 5),
      anomalies: buildAnomalySignals(summary),
      forecast: reportType === "crime-trend-forecast-report" ? "Rule-based historical forecast indicators are emphasized in this report." : "Forecast indicators available in trend-specific reports.",
      recommendations,
      ai_note: GEMINI_API_KEY ? `Gemini prompt should use the ${definition.title} section contract.` : `${definition.title} generated by rule engine because GEMINI_API_KEY is not configured.`
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
    if (req.method === "GET" && path === "/report/summary") return send(res, 200, { success: true, data: { total_records: totalRecords, records_analyzed: totalRecords, available_report_types: Object.keys(REPORT_DEFINITIONS), ai_mode: GEMINI_API_KEY ? "Gemini" : "Rule-based fallback", coordinate_available_percentage: pct(allRecords.filter(hasCoordinates).length, allRecords.length), generated_at: new Date().toISOString(), status: "ready" } });
    if (req.method === "GET" && path === "/report/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });
    if ((req.method === "GET" && (path === "/report/preview" || path === "/report/generate")) || (req.method === "POST" && (path === "/report/preview" || path === "/report/generate" || path === "/reports/generate"))) {
      const body = req.method === "POST" ? await readJsonBody(req) : getQuery(req);
      const filters = body.filters || body;
      const records = applyFilters(allRecords, filters);
      if (!records.length) return send(res, 200, { success: true, data: null, message: "No crime data available for selected filters." });
      const report = buildReport(records, body, { totalUploadedRecords: totalRecords });
      report.download_url = `/server/report-api/report/generate?report_id=${encodeURIComponent(report.report_id)}`;
      return send(res, 200, { success: true, data: report });
    }
    return send(res, 404, { success: false, message: "Route not found", path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[report-api] request failed", error);
    return send(res, 500, { success: false, message: "Report API failed", error: error.message, details: error.toString(), path, stack: error.stack });
  }
};
