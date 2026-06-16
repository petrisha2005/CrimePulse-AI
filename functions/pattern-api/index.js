const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  getMonthlyTrend,
  hasCoordinates,
  isHeinous,
  recommendedAction,
  toNumber,
  topN
} = require("./crimeAnalytics");

const SERVICE_NAME = "pattern-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /patterns/discover",
  "GET /patterns/summary",
  "GET /patterns/by-type",
  "GET /patterns/whispers",
  "GET /patterns/charts",
  "GET /patterns/filters",
  "GET /patterns/detail/:patternId"
];
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
const severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function send(res, statusCode, data) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(data));
}

function getPath(req, serviceName) {
  const rawUrl = req.url || "/";
  const urlOnly = rawUrl.split("?")[0];
  return urlOnly
    .replace(`/server/${serviceName}`, "")
    .replace(new RegExp(`^/${serviceName}`), "")
    .replace(/\/+$/, "") || "/";
}

function query(req) {
  return Object.fromEntries(new URL(req.url || "/", `https://${req.headers.host || "catalyst.local"}`).searchParams.entries());
}

function clean(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function countBy(items, field) {
  return Object.values(items.reduce((acc, item) => {
    const name = clean(item[field]) || "Unknown";
    acc[name] = acc[name] || { name, value: 0, count: 0 };
    acc[name].value += 1;
    acc[name].count += 1;
    return acc;
  }, {})).sort((a, b) => b.value - a.value);
}

function unique(records, field) {
  return [...new Set(records.map((record) => clean(record[field])).filter(Boolean))];
}

function confidence({ count = 0, total = 1, concentration = 0, completeness = 80, consistency = 50 }) {
  const countScore = Math.min(35, count * 2);
  const concentrationScore = Math.min(35, concentration * 0.35);
  return Math.max(1, Math.min(100, Math.round(countScore + concentrationScore + completeness * 0.2 + consistency * 0.1)));
}

function severityFrom({ concentration = 0, confidenceScore = 0, heinous = false, gap = false, spike = 0 }) {
  if ((heinous && concentration >= 35) || spike >= 200 || (gap && concentration >= 90)) return "Critical";
  if (concentration >= 50 || confidenceScore >= 80 || spike >= 100 || heinous) return "High";
  if (concentration >= 25 || confidenceScore >= 55 || spike >= 50 || gap) return "Medium";
  return "Low";
}

function completenessScore(records) {
  if (!records.length) return 0;
  const complete = records.filter((record) =>
    clean(record.district) &&
    clean(record.police_station) &&
    clean(record.crime_type) &&
    clean(record.fir_year) &&
    clean(record.fir_month) &&
    clean(record.fir_day)
  ).length;
  return pct(complete, records.length);
}

function createPattern({ pattern_type, title, district = "", police_station = "", crime_type = "", crime_subtype = "", severity = "Medium", confidence_score = 60, time_period = "Current filtered dataset", explanation, evidence = [], suggested_action }) {
  return {
    pattern_id: [pattern_type, district, police_station, crime_type, crime_subtype, time_period].map(slug).join("__"),
    pattern_type,
    title,
    district,
    police_station,
    crime_type,
    crime_subtype,
    severity,
    confidence_score,
    time_period,
    explanation,
    evidence,
    suggested_action: suggested_action || recommendedAction(crime_type),
    detected_at: new Date().toISOString()
  };
}

function addRepeatedCrimeTypePatterns(patterns, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    if (districtRecords.length < 10) return;
    topN(districtRecords, "crime_type", 3).forEach((crimeItem) => {
      const share = pct(crimeItem.value, districtRecords.length);
      if (crimeItem.value < 5 || share < 20) return;
      const scoped = districtRecords.filter((record) => record.crime_type === crimeItem.name);
      const score = confidence({ count: crimeItem.value, total: districtRecords.length, concentration: share, completeness: completenessScore(scoped), consistency: unique(scoped, "fir_month").length * 8 });
      patterns.push(createPattern({
        pattern_type: "Repeated Crime Type Pattern",
        title: `Repeated ${crimeItem.name} pattern detected in ${districtItem.name}`,
        district: districtItem.name,
        police_station: topN(scoped, "police_station", 1)[0]?.name || "",
        crime_type: crimeItem.name,
        crime_subtype: topN(scoped, "crime_subtype", 1)[0]?.name || "",
        severity: severityFrom({ concentration: share, confidenceScore: score }),
        confidence_score: score,
        time_period: getMonthlyTrend(scoped).at(-1)?.period || "Current dataset",
        explanation: `${crimeItem.name} appears repeatedly in ${districtItem.name}, contributing ${share}% of district records in the selected data.`,
        evidence: [`Supporting records: ${crimeItem.value}`, `District total: ${districtRecords.length}`, `Share: ${share}%`],
        suggested_action: recommendedAction(crimeItem.name)
      }));
    });
  });
}

function addSeasonalPatterns(patterns, records) {
  topN(records, "crime_type", 30).forEach((crimeItem) => {
    const crimeRecords = records.filter((record) => record.crime_type === crimeItem.name);
    if (crimeRecords.length < 10) return;
    const topMonth = topN(crimeRecords, "fir_month", 1)[0];
    const share = pct(topMonth?.value || 0, crimeRecords.length);
    if (!topMonth || share < 30) return;
    const topDistrict = topN(crimeRecords.filter((record) => record.fir_month === topMonth.name), "district", 1)[0]?.name || "";
    const score = confidence({ count: topMonth.value, total: crimeRecords.length, concentration: share, completeness: completenessScore(crimeRecords), consistency: 70 });
    patterns.push(createPattern({
      pattern_type: "Seasonal Crime Spike",
      title: `${crimeItem.name} is concentrated in FIR month ${topMonth.name}`,
      district: topDistrict,
      police_station: "",
      crime_type: crimeItem.name,
      crime_subtype: topN(crimeRecords, "crime_subtype", 1)[0]?.name || "",
      severity: severityFrom({ concentration: share, confidenceScore: score }),
      confidence_score: score,
      time_period: `FIR month ${topMonth.name}`,
      explanation: `${share}% of ${crimeItem.name} records are concentrated in FIR month ${topMonth.name}.`,
      evidence: [`Month ${topMonth.name} count: ${topMonth.value}`, `Crime type total: ${crimeRecords.length}`, `Top district: ${topDistrict || "No data"}`],
      suggested_action: recommendedAction(crimeItem.name)
    }));
  });
}

function addStationConcentrationPatterns(patterns, records) {
  topN(records, "district", 40).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    if (districtRecords.length < 10) return;
    const topStation = topN(districtRecords, "police_station", 1)[0];
    const share = pct(topStation?.value || 0, districtRecords.length);
    if (!topStation || share <= 35) return;
    const stationRecords = districtRecords.filter((record) => record.police_station === topStation.name);
    const score = confidence({ count: topStation.value, total: districtRecords.length, concentration: share, completeness: completenessScore(stationRecords), consistency: unique(stationRecords, "fir_month").length * 8 });
    patterns.push(createPattern({
      pattern_type: "Police Station Concentration",
      title: `Police station concentration observed in ${topStation.name}`,
      district: districtItem.name,
      police_station: topStation.name,
      crime_type: topN(stationRecords, "crime_type", 1)[0]?.name || "",
      crime_subtype: topN(stationRecords, "crime_subtype", 1)[0]?.name || "",
      severity: severityFrom({ concentration: share, confidenceScore: score }),
      confidence_score: score,
      time_period: "Current filtered dataset",
      explanation: `${topStation.name} contributes ${share}% of ${districtItem.name} crime records.`,
      evidence: [`Station records: ${topStation.value}`, `District records: ${districtRecords.length}`, `Share: ${share}%`],
      suggested_action: "Review police station-level deployment, beat coverage, and response load."
    }));
  });
}

function addCrimeHeadPatterns(patterns, records) {
  topN(records, "crime_type", 30).forEach((crimeItem) => {
    const crimeRecords = records.filter((record) => record.crime_type === crimeItem.name);
    if (crimeRecords.length < 10) return;
    const topHead = topN(crimeRecords, "crime_subtype", 1)[0];
    const share = pct(topHead?.value || 0, crimeRecords.length);
    if (!topHead || topHead.name === "Unknown" || share < 40) return;
    const scoped = crimeRecords.filter((record) => record.crime_subtype === topHead.name);
    const score = confidence({ count: topHead.value, total: crimeRecords.length, concentration: share, completeness: completenessScore(scoped), consistency: 65 });
    patterns.push(createPattern({
      pattern_type: "Crime Head Concentration Pattern",
      title: `${topHead.name} dominates ${crimeItem.name}`,
      district: topN(scoped, "district", 1)[0]?.name || "",
      police_station: topN(scoped, "police_station", 1)[0]?.name || "",
      crime_type: crimeItem.name,
      crime_subtype: topHead.name,
      severity: severityFrom({ concentration: share, confidenceScore: score }),
      confidence_score: score,
      time_period: "Current filtered dataset",
      explanation: `${topHead.name} contributes ${share}% of all ${crimeItem.name} records.`,
      evidence: [`Crime head records: ${topHead.value}`, `Crime type records: ${crimeRecords.length}`, `Share: ${share}%`],
      suggested_action: recommendedAction(crimeItem.name)
    }));
  });
}

function addHeinousPatterns(patterns, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    const heinousRecords = districtRecords.filter(isHeinous);
    const share = pct(heinousRecords.length, districtRecords.length);
    if (districtRecords.length < 10 || share < 15) return;
    const topCrime = topN(heinousRecords, "crime_type", 1)[0]?.name || "Heinous crime";
    const score = confidence({ count: heinousRecords.length, total: districtRecords.length, concentration: share, completeness: completenessScore(heinousRecords), consistency: unique(heinousRecords, "fir_month").length * 8 });
    patterns.push(createPattern({
      pattern_type: "Heinous Crime Pattern",
      title: `Heinous crime pattern visible in ${districtItem.name}`,
      district: districtItem.name,
      police_station: topN(heinousRecords, "police_station", 1)[0]?.name || "",
      crime_type: topCrime,
      crime_subtype: topN(heinousRecords, "crime_subtype", 1)[0]?.name || "",
      severity: severityFrom({ concentration: share, confidenceScore: score, heinous: true }),
      confidence_score: score,
      time_period: getMonthlyTrend(heinousRecords).at(-1)?.period || "Current dataset",
      explanation: `${share}% of district records are marked Heinous/High severity.`,
      evidence: [`Heinous records: ${heinousRecords.length}`, `District total: ${districtRecords.length}`, `Dominant heinous type: ${topCrime}`],
      suggested_action: recommendedAction(topCrime)
    }));
  });
}

function addWorkflowPatterns(patterns, records) {
  topN(records, "fir_stage", 12).forEach((stageItem) => {
    if (!stageItem.name || stageItem.name === "Unknown") return;
    const stageRecords = records.filter((record) => record.fir_stage === stageItem.name);
    const share = pct(stageItem.value, records.length);
    const stageText = stageItem.name.toLowerCase();
    if (stageItem.value < 10 || (share < 20 && !stageText.includes("pending"))) return;
    const score = confidence({ count: stageItem.value, total: records.length, concentration: share, completeness: completenessScore(stageRecords), consistency: 60 });
    patterns.push(createPattern({
      pattern_type: "FIR Stage Pattern",
      title: `${stageItem.name} FIR stage pattern detected`,
      district: topN(stageRecords, "district", 1)[0]?.name || "",
      police_station: topN(stageRecords, "police_station", 1)[0]?.name || "",
      crime_type: topN(stageRecords, "crime_type", 1)[0]?.name || "",
      crime_subtype: topN(stageRecords, "crime_subtype", 1)[0]?.name || "",
      severity: stageText.includes("pending") ? "Medium" : severityFrom({ concentration: share, confidenceScore: score }),
      confidence_score: score,
      time_period: "Current filtered dataset",
      explanation: `${stageItem.name} appears in ${share}% of selected records, indicating a case workflow pattern.`,
      evidence: [`Stage records: ${stageItem.value}`, `Selected records: ${records.length}`, `Top district: ${topN(stageRecords, "district", 1)[0]?.name || "No data"}`],
      suggested_action: "Review case workflow, pendency, evidence tracking, and investigation follow-up."
    }));
  });
}

function addComplaintModePatterns(patterns, records) {
  const topMode = topN(records, "complaint_mode", 1)[0];
  const share = pct(topMode?.value || 0, records.length);
  if (!topMode || topMode.name === "Unknown" || topMode.value < 10 || share < 45) return;
  const modeRecords = records.filter((record) => record.complaint_mode === topMode.name);
  const score = confidence({ count: topMode.value, total: records.length, concentration: share, completeness: completenessScore(modeRecords), consistency: 60 });
  patterns.push(createPattern({
    pattern_type: "Complaint Mode Pattern",
    title: `${topMode.name} dominates complaint reporting`,
    district: topN(modeRecords, "district", 1)[0]?.name || "",
    police_station: topN(modeRecords, "police_station", 1)[0]?.name || "",
    crime_type: topN(modeRecords, "crime_type", 1)[0]?.name || "",
    crime_subtype: "",
    severity: "Low",
    confidence_score: score,
    time_period: "Current filtered dataset",
    explanation: `${topMode.name} accounts for ${share}% of complaint mode values.`,
    evidence: [`Mode count: ${topMode.value}`, `Selected records: ${records.length}`, `Share: ${share}%`],
    suggested_action: "Use complaint channel pattern to improve citizen reporting and intake planning."
  }));
}

function addConvictionGapPatterns(patterns, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    const accused = districtRecords.reduce((sum, record) => sum + toNumber(record.accused_count), 0);
    const convictions = districtRecords.reduce((sum, record) => sum + toNumber(record.conviction_count), 0);
    const convictionRate = pct(convictions, accused);
    if (accused < 20 || convictionRate >= 10) return;
    const gap = 100 - convictionRate;
    const topCrime = topN(districtRecords, "crime_type", 1)[0]?.name || "";
    const score = confidence({ count: accused, total: Math.max(accused, 1), concentration: gap, completeness: completenessScore(districtRecords), consistency: 55 });
    patterns.push(createPattern({
      pattern_type: "Low Conviction / High Accused Gap",
      title: `Low conviction gap requires follow-up in ${districtItem.name}`,
      district: districtItem.name,
      police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
      crime_type: topCrime,
      crime_subtype: topN(districtRecords, "crime_subtype", 1)[0]?.name || "",
      severity: severityFrom({ concentration: gap, confidenceScore: score, gap: true }),
      confidence_score: score,
      time_period: "Current filtered dataset",
      explanation: `Conviction rate is ${convictionRate}% against ${accused} accused count in ${districtItem.name}.`,
      evidence: [`Accused count: ${accused}`, `Conviction count: ${convictions}`, `Conviction rate: ${convictionRate}%`],
      suggested_action: "Strengthen evidence collection, chargesheet quality, and case monitoring."
    }));
  });
}

function addDataQualityPatterns(patterns, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    if (districtRecords.length < 10) return;
    const missing = districtRecords.filter((record) => !hasCoordinates(record)).length;
    const missingShare = pct(missing, districtRecords.length);
    if (missingShare < 40) return;
    const score = confidence({ count: missing, total: districtRecords.length, concentration: missingShare, completeness: completenessScore(districtRecords), consistency: 50 });
    patterns.push(createPattern({
      pattern_type: "Data Quality Pattern",
      title: `Coordinate data missing for many ${districtItem.name} records`,
      district: districtItem.name,
      police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
      crime_type: "Data Quality",
      crime_subtype: "",
      severity: missingShare >= 70 ? "Medium" : "Low",
      confidence_score: score,
      time_period: "Current filtered dataset",
      explanation: `${missingShare}% of records in ${districtItem.name} are missing latitude_value or longitude_value.`,
      evidence: [`Missing coordinates: ${missing}`, `District records: ${districtRecords.length}`, `Missing share: ${missingShare}%`],
      suggested_action: "Improve FIR geotagging and data quality checks to strengthen hotspot accuracy."
    }));
  });
}

function addEmergingCategoryPatterns(patterns, records) {
  const monthly = getMonthlyTrend(records).filter((item) => item.period !== "Unknown");
  if (monthly.length < 2) return;
  const latest = monthly.at(-1);
  const latestRecords = records.filter((record) => `${record.fir_year}-${String(record.fir_month).padStart(2, "0")}` === latest.period);
  topN(latestRecords, "crime_type", 15).forEach((crimeItem) => {
    const previousRecords = records.filter((record) => `${record.fir_year}-${String(record.fir_month).padStart(2, "0")}` !== latest.period && record.crime_type === crimeItem.name);
    const previousMonths = Math.max(1, unique(previousRecords, "fir_month").length);
    const previousAverage = previousRecords.length / previousMonths;
    const increase = previousAverage > 0 ? Math.round(((crimeItem.value - previousAverage) / previousAverage) * 100) : 100;
    if (crimeItem.value < 3 || increase < 50) return;
    const scoped = latestRecords.filter((record) => record.crime_type === crimeItem.name);
    const score = confidence({ count: crimeItem.value, total: latestRecords.length, concentration: Math.min(increase, 100), completeness: completenessScore(scoped), consistency: 80 });
    patterns.push(createPattern({
      pattern_type: "Emerging Crime Category",
      title: `${crimeItem.name} emerging in latest FIR month`,
      district: topN(scoped, "district", 1)[0]?.name || "",
      police_station: topN(scoped, "police_station", 1)[0]?.name || "",
      crime_type: crimeItem.name,
      crime_subtype: topN(scoped, "crime_subtype", 1)[0]?.name || "",
      severity: severityFrom({ concentration: Math.min(increase, 100), confidenceScore: score, spike: increase }),
      confidence_score: score,
      time_period: latest.period,
      explanation: `${crimeItem.name} reached ${crimeItem.value} records in ${latest.period}, ${increase}% above prior-month baseline.`,
      evidence: [`Latest count: ${crimeItem.value}`, `Previous average: ${Math.round(previousAverage)}`, `Increase: ${increase}%`],
      suggested_action: recommendedAction(crimeItem.name)
    }));
  });
}

function isActive(value) {
  const normalized = clean(value).toLowerCase();
  return normalized !== "" && normalized !== "all";
}

function discoverPatterns(records, params = {}) {
  if (!records.length) return [];
  const patterns = [];
  addRepeatedCrimeTypePatterns(patterns, records);
  addSeasonalPatterns(patterns, records);
  addStationConcentrationPatterns(patterns, records);
  addCrimeHeadPatterns(patterns, records);
  addHeinousPatterns(patterns, records);
  addWorkflowPatterns(patterns, records);
  addComplaintModePatterns(patterns, records);
  addConvictionGapPatterns(patterns, records);
  addDataQualityPatterns(patterns, records);
  addEmergingCategoryPatterns(patterns, records);

  const patternType = clean(params.pattern_type).toLowerCase();
  const confidenceMin = Number(params.confidence_min || 0);
  return patterns
    .filter((pattern) => !isActive(patternType) || pattern.pattern_type.toLowerCase() === patternType)
    .filter((pattern) => !Number.isFinite(confidenceMin) || pattern.confidence_score >= confidenceMin)
    .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.confidence_score - a.confidence_score)
    .slice(0, 100);
}

function summary(patterns, records) {
  return {
    total_patterns_detected: patterns.length,
    critical_patterns: patterns.filter((pattern) => pattern.severity === "Critical").length,
    high_confidence_patterns: patterns.filter((pattern) => pattern.confidence_score >= 75).length,
    most_affected_district: countBy(patterns, "district").find((item) => item.name !== "Unknown")?.name || topN(records, "district", 1)[0]?.name || "No data",
    most_repeated_crime_type: countBy(patterns, "crime_type").find((item) => item.name !== "Unknown")?.name || topN(records, "crime_type", 1)[0]?.name || "No data",
    latest_detected_pattern: patterns[0]?.title || "No major patterns detected",
    total_patterns: patterns.length,
    high_severity_patterns: patterns.filter((pattern) => pattern.severity === "High").length,
    dominant_pattern_type: countBy(patterns, "pattern_type")[0]?.name || "No patterns",
    top_crime_type: topN(records, "crime_type", 1)[0]?.name || "No data"
  };
}

function charts(patterns, records) {
  const monthlyTrend = getMonthlyTrend(records).slice(-12).map((item) => ({ name: item.period, value: item.count, count: item.count }));
  return {
    pattern_count_by_type: countBy(patterns, "pattern_type"),
    severity_distribution: countBy(patterns, "severity"),
    districts_with_most_patterns: countBy(patterns, "district").filter((item) => item.name !== "Unknown").slice(0, 10),
    crime_types_with_most_patterns: countBy(patterns, "crime_type").filter((item) => item.name !== "Unknown").slice(0, 10),
    monthly_pattern_trend: monthlyTrend,
    patternTypes: countBy(patterns, "pattern_type"),
    crimeTypes: countBy(patterns, "crime_type").filter((item) => item.name !== "Unknown").slice(0, 10),
    monthlyPatternTrend: monthlyTrend
  };
}

function whispers(patterns) {
  return patterns.slice(0, 6).map((pattern) => {
    if (pattern.pattern_type === "Data Quality Pattern") return "Coordinate data missing for many records, reducing hotspot accuracy.";
    if (pattern.pattern_type === "Low Conviction / High Accused Gap") return "Low conviction gap requires investigation follow-up.";
    if (pattern.pattern_type === "Police Station Concentration") return `Police station concentration observed in ${pattern.police_station}.`;
    if (pattern.pattern_type === "Repeated Crime Type Pattern") return `Repeated ${pattern.crime_type} pattern detected in ${pattern.district}.`;
    return pattern.title;
  });
}

function buildFilters(records, patterns) {
  const base = filterOptions(records);
  const patternTypes = [...new Set([
    "Repeated Crime Type Pattern",
    "Seasonal Crime Spike",
    "Police Station Concentration",
    "Crime Head Concentration Pattern",
    "Heinous Crime Pattern",
    "FIR Stage Pattern",
    "Complaint Mode Pattern",
    "Low Conviction / High Accused Gap",
    "Data Quality Pattern",
    "Emerging Crime Category",
    ...patterns.map((pattern) => pattern.pattern_type)
  ])].sort();
  return { ...base, patternTypes, pattern_type: patternTypes };
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[pattern-api] method:", method);
  console.log("[pattern-api] raw url:", req.url);
  console.log("[pattern-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI pattern-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const params = query(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);
    const patterns = discoverPatterns(records, params);

    if (method === "GET" && path === "/patterns/discover") return send(res, 200, { success: true, data: patterns });
    if (method === "GET" && path === "/patterns/summary") return send(res, 200, { success: true, data: summary(patterns, records) });
    if (method === "GET" && path === "/patterns/by-type") return send(res, 200, { success: true, data: countBy(patterns, "pattern_type") });
    if (method === "GET" && path === "/patterns/whispers") return send(res, 200, { success: true, data: whispers(patterns) });
    if (method === "GET" && path === "/patterns/charts") return send(res, 200, { success: true, data: charts(patterns, records) });
    if (method === "GET" && path === "/patterns/filters") return send(res, 200, { success: true, data: buildFilters(allRecords, discoverPatterns(allRecords)) });

    if (method === "GET" && path.startsWith("/patterns/detail/")) {
      const patternId = decodeURIComponent(path.replace("/patterns/detail/", ""));
      const pattern = patterns.find((item) => item.pattern_id === patternId) || null;
      return send(res, pattern ? 200 : 404, { success: Boolean(pattern), data: pattern, message: pattern ? undefined : "Pattern not found" });
    }

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[pattern-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Pattern API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
