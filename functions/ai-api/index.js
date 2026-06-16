const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  getDashboardSummary,
  getMonthlyTrend,
  hasCoordinates,
  isHeinous,
  recommendedAction,
  topN,
  toNumber
} = require("./crimeAnalytics");

const SERVICE_NAME = "ai-api";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AI_MODE = GEMINI_API_KEY ? "Gemini" : "Rule-based fallback";
const SYSTEM_PROMPT = "You are CrimePulse AI, an AI crime intelligence assistant for police officers. Use only the summarized analytics data provided. Do not invent numbers, districts, police stations, crime types, predictions, or conclusions. If a value is missing, say data not available.";
const AVAILABLE_ROUTES = ["GET /", "GET /health", "GET /ai/summary", "GET /ai/insights", "GET /ai/explain-risk", "GET /ai/ask", "POST /ai/ask", "GET /ai/recommendations", "GET /ai/filters"];
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
const riskLevel = (score) => score > 80 ? "Critical" : score > 60 ? "High" : score > 30 ? "Medium" : "Low";

function buildAnalytics(records, filters = {}) {
  const summary = getDashboardSummary(records);
  const topDistricts = topN(records, "district", 10);
  const topStations = topN(records, "police_station", 10);
  const topCrimes = topN(records, "crime_type", 10);
  const topHeads = topN(records, "crime_subtype", 10);
  const stages = topN(records, "fir_stage", 10);
  const complaintModes = topN(records, "complaint_mode", 10);
  const monthlyTrend = getMonthlyTrend(records).slice(-12);
  const heinous = records.filter(isHeinous).length;
  const accused = records.reduce((sum, record) => sum + toNumber(record.accused_count), 0);
  const arrested = records.reduce((sum, record) => sum + toNumber(record.arrested_count), 0);
  const convictions = records.reduce((sum, record) => sum + toNumber(record.conviction_count), 0);
  const coordinateAvailability = pct(records.filter(hasCoordinates).length, records.length);
  const convictionRate = pct(convictions, accused);
  const arrestRate = pct(arrested, accused);
  const riskScore = Math.min(100, Math.round((records.length / Math.max(topDistricts.length || 1, 1)) / 2 + pct(heinous, records.length) * 0.6 + Math.max(0, 100 - convictionRate) * 0.2));
  return {
    filters,
    total_records: records.length,
    total_records_analyzed: records.length,
    district_ranking: topDistricts,
    police_station_ranking: topStations,
    crime_type_ranking: topCrimes,
    crime_head_ranking: topHeads,
    heinous_count: heinous,
    non_heinous_count: Math.max(records.length - heinous, 0),
    yearly_monthly_trend: monthlyTrend,
    fir_stage_distribution: stages,
    complaint_mode_distribution: complaintModes,
    victim_count: summary.totalVictims,
    accused_count: accused,
    arrested_count: arrested,
    conviction_count: convictions,
    arrest_rate: arrestRate,
    conviction_rate: convictionRate,
    coordinate_available_percentage: coordinateAvailability,
    highest_risk_district: topDistricts[0]?.name || "No data",
    highest_risk_crime_type: topCrimes[0]?.name || "No data",
    strongest_pattern: `${topCrimes[0]?.name || "Crime"} concentration in ${topDistricts[0]?.name || "top district"}`,
    main_operational_gap: convictionRate < 10 ? "Legal resolution gap" : coordinateAvailability < 40 ? "Coordinate data quality" : "Police station concentration",
    risk_score: riskScore,
    risk_level: riskLevel(riskScore),
    risk_highlights: [
      `${topDistricts[0]?.name || "No district"} has the highest record volume.`,
      `${topCrimes[0]?.name || "No crime type"} is the most common crime type.`,
      `${heinous} heinous/high severity records detected.`
    ],
    anomaly_highlights: [
      coordinateAvailability < 40 ? "Coordinate availability is low and may limit hotspot precision." : "Coordinate availability is usable for spatial review.",
      convictionRate < 10 ? "Conviction rate is low compared with accused count." : "Legal resolution indicators are within visible data range."
    ],
    recommendations: [
      recommendedAction(topCrimes[0]?.name || ""),
      "Review top district and police station concentration before deployment planning.",
      convictionRate < 10 ? "Strengthen evidence tracking and case follow-up." : "Continue monitoring arrest and conviction flow.",
      coordinateAvailability < 40 ? "Improve FIR geotagging and location capture." : "Maintain coordinate capture quality."
    ]
  };
}

function insightsFromAnalytics(a) {
  return [
    {
      insight_id: "risk-alert-1",
      insight_type: "Risk Alert",
      type: "Risk Alert",
      title: `${a.highest_risk_district} needs highest operational attention`,
      priority: a.risk_level === "Critical" ? "Critical" : "High",
      district: a.highest_risk_district,
      crime_type: a.highest_risk_crime_type,
      explanation: `${a.highest_risk_district} leads the district ranking in the selected records.`,
      evidence: a.risk_highlights,
      recommendation: a.recommendations[1],
      confidence_score: 82,
      confidence: 82
    },
    {
      insight_id: "pattern-1",
      insight_type: "Crime Pattern",
      type: "Crime Pattern",
      title: `${a.highest_risk_crime_type} is the strongest pattern`,
      priority: "High",
      district: a.highest_risk_district,
      crime_type: a.highest_risk_crime_type,
      explanation: `${a.highest_risk_crime_type} is the most frequent crime type in the selected dataset.`,
      evidence: a.crime_type_ranking.slice(0, 3).map((item) => `${item.name}: ${item.value}`),
      recommendation: recommendedAction(a.highest_risk_crime_type),
      confidence_score: 85,
      confidence: 85
    },
    {
      insight_id: "legal-gap-1",
      insight_type: "Legal Resolution Gap",
      type: "Legal Resolution Gap",
      title: a.main_operational_gap,
      priority: a.conviction_rate < 10 ? "High" : "Medium",
      district: a.highest_risk_district,
      crime_type: a.highest_risk_crime_type,
      explanation: `Arrest rate is ${a.arrest_rate}% and conviction rate is ${a.conviction_rate}% in selected records.`,
      evidence: [`Accused: ${a.accused_count}`, `Arrested: ${a.arrested_count}`, `Convictions: ${a.conviction_count}`],
      recommendation: "Strengthen investigation review, evidence tracking, and case follow-up.",
      confidence_score: 78,
      confidence: 78
    },
    {
      insight_id: "data-quality-1",
      insight_type: "Data Quality",
      type: "Data Quality",
      title: "Coordinate readiness affects hotspot precision",
      priority: a.coordinate_available_percentage < 40 ? "Medium" : "Low",
      district: "Statewide",
      crime_type: "Data Quality",
      explanation: `${a.coordinate_available_percentage}% of records have usable coordinates.`,
      evidence: [`Coordinate availability: ${a.coordinate_available_percentage}%`],
      recommendation: "Mandate FIR geotagging and location capture for future uploads.",
      confidence_score: 90,
      confidence: 90
    }
  ];
}

function recommendationsFromAnalytics(a) {
  return a.recommendations.map((action, index) => ({
    priority: index === 0 ? "High" : "Medium",
    title: index === 0 ? `${a.highest_risk_crime_type} operational focus` : "Operational improvement",
    action,
    district: index === 0 ? a.highest_risk_district : "Statewide",
    police_station: a.police_station_ranking[index]?.name || "All",
    crime_type: index === 0 ? a.highest_risk_crime_type : "All",
    reason: index === 0 ? `${a.highest_risk_crime_type} is the leading pattern.` : a.anomaly_highlights[index - 1] || "Visible analytics indicate improvement opportunity.",
    expected_impact: "Improved prevention, investigation focus, and data quality."
  }));
}

async function geminiText(prompt, fallback) {
  if (!GEMINI_API_KEY || typeof fetch !== "function") return fallback;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }] })
    });
    if (!response.ok) return fallback;
    const body = await response.json();
    return body.candidates?.[0]?.content?.parts?.[0]?.text || fallback;
  } catch {
    return fallback;
  }
}

function answerQuestion(question, a) {
  const q = String(question || "").toLowerCase();
  if (q.includes("district")) return `${a.highest_risk_district} needs highest attention based on record volume and risk highlights.`;
  if (q.includes("crime type") || q.includes("most common")) return `${a.highest_risk_crime_type} is the most common crime type in the selected records.`;
  if (q.includes("police station")) return `${a.police_station_ranking[0]?.name || "Data not available"} needs attention based on police station ranking.`;
  if (q.includes("recommend")) return a.recommendations.join(" ");
  if (q.includes("why") || q.includes("risk")) return `Risk is driven by ${a.total_records} records, ${a.heinous_count} heinous records, top district ${a.highest_risk_district}, and top crime type ${a.highest_risk_crime_type}.`;
  return "The uploaded data supports district, police station, crime type, FIR stage, complaint mode, legal gap, and coordinate quality questions. Please ask one of those directly.";
}

module.exports = async (req, res) => {
  const path = getPath(req, SERVICE_NAME);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI ai-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (req.method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });
  try {
    const app = catalyst.initialize(req);
    const allRecords = await fetchCrimeRecords(app);
    const params = getQuery(req);
    const body = req.method === "POST" ? await readJsonBody(req) : {};
    const filters = body.filters || params;
    const records = applyFilters(allRecords, filters);
    const analytics = buildAnalytics(records, filters);

    if (req.method === "GET" && path === "/ai/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });
    if (req.method === "GET" && path === "/ai/summary") {
      return send(res, 200, {
        success: true,
        data: {
          total_records: records.length,
          total_records_analyzed: records.length,
          records_analyzed: records.length,
          total_ai_insights: insightsFromAnalytics(analytics).length,
          districts_covered: new Set(records.map((record) => record.district).filter(Boolean)).size,
          police_stations_covered: new Set(records.map((record) => record.police_station).filter(Boolean)).size,
          dominant_crime_type: analytics.highest_risk_crime_type,
          highest_risk_district: analytics.highest_risk_district,
          highest_risk_crime_type: analytics.highest_risk_crime_type,
          strongest_pattern: analytics.strongest_pattern,
          main_operational_gap: analytics.main_operational_gap,
          risk_score: analytics.risk_score,
          risk_level: analytics.risk_level,
          heinous_count: analytics.heinous_count,
          non_heinous_count: analytics.non_heinous_count,
          total_victims: analytics.victim_count,
          total_accused: analytics.accused_count,
          total_arrests: analytics.arrested_count,
          total_convictions: analytics.conviction_count,
          arrest_rate: analytics.arrest_rate,
          conviction_rate: analytics.conviction_rate,
          coordinate_available_percentage: analytics.coordinate_available_percentage,
          generated_at: new Date().toISOString(),
          ai_mode: AI_MODE
        }
      });
    }
    if (req.method === "GET" && path === "/ai/insights") return send(res, 200, { success: true, data: insightsFromAnalytics(analytics) });
    if (req.method === "GET" && path === "/ai/recommendations") return send(res, 200, { success: true, data: recommendationsFromAnalytics(analytics) });
    if (req.method === "GET" && path === "/ai/explain-risk") return send(res, 200, { success: true, data: { title: `Risk explanation for ${params.district || params.crime_type || params.police_station || "selected records"}`, explanation: `Risk level is ${analytics.risk_level} with score ${analytics.risk_score}.`, key_reasons: analytics.risk_highlights, supporting_metrics: { total_records: analytics.total_records, heinous_count: analytics.heinous_count, conviction_rate: analytics.conviction_rate, coordinate_available_percentage: analytics.coordinate_available_percentage }, recommended_actions: analytics.recommendations, confidence_score: 82 } });
    if ((req.method === "GET" || req.method === "POST") && path === "/ai/ask") {
      const question = body.question || params.question || "Which district has highest crime risk?";
      const fallback = answerQuestion(question, analytics);
      const answer = await geminiText(`Question: ${question}\nAnalytics summary: ${JSON.stringify(analytics)}`, fallback);
      return send(res, 200, { success: true, data: { question, answer, evidence: analytics.risk_highlights, confidence_score: GEMINI_API_KEY ? 88 : 78, confidence: GEMINI_API_KEY ? 88 : 78, records_analyzed: records.length, ai_mode: AI_MODE } });
    }
    return send(res, 404, { success: false, message: "Route not found", path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[ai-api] request failed", error);
    return send(res, 500, { success: false, message: "AI API failed", error: error.message, details: error.toString(), path, stack: error.stack });
  }
};
