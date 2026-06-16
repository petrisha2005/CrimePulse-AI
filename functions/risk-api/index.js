const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  getMonthlyTrend,
  isHeinous,
  isNonHeinous,
  recommendedAction,
  topN,
  unique
} = require("./crimeAnalytics");

const SERVICE_NAME = "risk-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /risk/districts",
  "GET /risk/dna/:district",
  "GET /risk/score/:district",
  "GET /risk/why/:district",
  "GET /risk/recommendations/:district",
  "GET /risk/summary",
  "GET /risk/filters",
  "GET /risk-intelligence/summary",
  "GET /risk-intelligence/district-risk",
  "GET /risk-intelligence/police-station-risk",
  "GET /risk-intelligence/crime-type-risk",
  "GET /risk-intelligence/priority-zones",
  "GET /risk-intelligence/risk-factors",
  "GET /risk-intelligence/intervention-plan",
  "GET /risk-intelligence/filters"
];

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

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

function getQuery(req) {
  return Object.fromEntries(new URL(req.url || "/", `https://${req.headers.host || "catalyst.local"}`).searchParams.entries());
}

const number = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percentage = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const requiredComplete = (record) => Boolean(record.district && record.police_station && record.crime_type && record.fir_year && record.fir_month && record.fir_day);
const coordinatesAvailable = (record) => record.latitude_value !== "" && record.longitude_value !== "" && record.latitude_value !== null && record.longitude_value !== null;

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function riskMetrics(allRecords, districtRecords) {
  const districtCount = unique(allRecords, "district").length || 1;
  const averageDistrictCrime = allRecords.length / districtCount;
  const total = districtRecords.length;
  const heinous = districtRecords.filter(isHeinous).length;
  const monthly = getMonthlyTrend(districtRecords);
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.at(-2)?.count || latest;
  const topStationCount = topN(districtRecords, "police_station", 1)[0]?.value || 0;
  const accused = districtRecords.reduce((sum, record) => sum + number(record.accused_count), 0);
  const arrested = districtRecords.reduce((sum, record) => sum + number(record.arrested_count), 0);
  const convictions = districtRecords.reduce((sum, record) => sum + number(record.conviction_count), 0);
  const arrestRate = percentage(arrested, accused);
  const convictionRate = percentage(convictions, accused);
  const requiredCompleteness = percentage(districtRecords.filter(requiredComplete).length, total);
  const coordinatePercentage = percentage(districtRecords.filter(coordinatesAvailable).length, total);
  const confidenceScore = clamp(requiredCompleteness * 0.7 + coordinatePercentage * 0.3);

  const volumeScore = clamp((total / Math.max(averageDistrictCrime, 1)) * 12.5, 0, 25);
  const heinousScore = clamp((heinous / Math.max(total, 1)) * 100 * 0.2, 0, 20);
  const trendScore = clamp(previous > 0 ? ((latest - previous) / previous) * 20 + 10 : 8, 0, 20);
  const concentrationScore = clamp((topStationCount / Math.max(total, 1)) * 100 * 0.15, 0, 15);
  const gapScore = clamp((100 - Math.max(arrestRate, convictionRate)) * 0.1, 0, 10);
  const dataConfidenceScore = clamp(confidenceScore * 0.1, 0, 10);
  const riskScore = clamp(volumeScore + heinousScore + trendScore + concentrationScore + gapScore + dataConfidenceScore);

  return {
    averageDistrictCrime,
    volumeScore,
    heinousScore,
    trendScore,
    concentrationScore,
    gapScore,
    dataConfidenceScore,
    risk_score: riskScore,
    risk_level: riskLevel(riskScore),
    confidence_score: confidenceScore,
    trend_direction: latest > previous * 1.1 ? "Increasing" : latest < previous * 0.9 ? "Decreasing" : "Stable",
    arrest_rate: arrestRate,
    conviction_rate: convictionRate,
    coordinate_available_percentage: coordinatePercentage
  };
}

function sumField(records, field) {
  return records.reduce((sum, record) => sum + number(record[field]), 0);
}

function groupRecords(records, field) {
  return records.reduce((acc, record) => {
    const key = String(record[field] || "Unknown").trim() || "Unknown";
    acc[key] = acc[key] || [];
    acc[key].push(record);
    return acc;
  }, {});
}

function monthlyDirection(records) {
  const monthly = getMonthlyTrend(records);
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.slice(-4, -1);
  const average = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest;
  return latest > average * 1.1 ? "Increasing" : latest < average * 0.9 ? "Decreasing" : "Stable";
}

function intelligenceScore(records, allRecords, maxVolume) {
  const total = records.length;
  const volumeScore = maxVolume > 0 ? (total / maxVolume) * 25 : 0;
  const heinousShare = percentage(records.filter(isHeinous).length, total);
  const heinousScore = heinousShare * 0.2;
  const monthly = getMonthlyTrend(records);
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.slice(-4, -1);
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest;
  const trendGrowth = previousAverage > 0 ? Math.max(0, ((latest - previousAverage) / previousAverage) * 100) : 0;
  const trendScore = Math.min(15, trendGrowth * 0.15);
  const topStationShare = percentage(topN(records, "police_station", 1)[0]?.value || 0, total);
  const concentrationScore = topStationShare * 0.15;
  const accused = sumField(records, "accused_count");
  const arrested = sumField(records, "arrested_count");
  const convictions = sumField(records, "conviction_count");
  const arrestRate = percentage(arrested, accused);
  const convictionRate = percentage(convictions, accused);
  const legalGapScore = Math.max(0, 100 - Math.round(arrestRate * 0.45 + convictionRate * 0.55)) * 0.1;
  const pendingShare = percentage(records.filter((record) => String(record.fir_stage || "").toLowerCase().includes("pending")).length, total);
  const pendingScore = pendingShare * 0.1;
  const coordinatePct = percentage(records.filter(coordinatesAvailable).length, total);
  const requiredPct = percentage(records.filter(requiredComplete).length, total);
  const dataConfidenceScore = Math.round((requiredPct * 0.7 + coordinatePct * 0.3) * 0.05);
  const riskScore = clamp(volumeScore + heinousScore + trendScore + concentrationScore + legalGapScore + pendingScore + dataConfidenceScore);
  return {
    risk_score: riskScore,
    risk_level: riskLevel(riskScore),
    heinous_share: heinousShare,
    trend_direction: monthlyDirection(records),
    conviction_gap_score: Math.round(legalGapScore / 0.1),
    pending_stage_share: pendingShare,
    coordinate_available_percentage: coordinatePct,
    score_breakdown: {
      crime_volume: Math.round(volumeScore / 25 * 100),
      heinous_crime_share: Math.round(heinousScore / 20 * 100),
      trend_growth: Math.round(trendScore / 15 * 100),
      police_station_concentration: Math.round(concentrationScore / 15 * 100),
      legal_resolution_gap: Math.round(legalGapScore / 10 * 100),
      fir_stage_pending: Math.round(pendingScore / 10 * 100),
      data_confidence: Math.round(dataConfidenceScore / 5 * 100)
    }
  };
}

function districtRisk(records) {
  const groups = groupRecords(records, "district");
  const maxVolume = Math.max(...Object.values(groups).map((items) => items.length), 1);
  return Object.entries(groups).map(([district, scoped]) => {
    const metrics = intelligenceScore(scoped, records, maxVolume);
    const topCrime = topN(scoped, "crime_type", 1)[0]?.name || "No data";
    const topStation = topN(scoped, "police_station", 1)[0]?.name || "No data";
    return {
      district,
      risk_score: metrics.risk_score,
      risk_level: metrics.risk_level,
      total_crimes: scoped.length,
      heinous_count: scoped.filter(isHeinous).length,
      heinous_share: metrics.heinous_share,
      top_crime_type: topCrime,
      top_police_station: topStation,
      trend_direction: metrics.trend_direction,
      conviction_gap_score: metrics.conviction_gap_score,
      pending_stage_share: metrics.pending_stage_share,
      coordinate_available_percentage: metrics.coordinate_available_percentage,
      explanation: `${district} risk is driven by ${scoped.length} records, ${metrics.heinous_share}% heinous share, and ${topStation} station concentration.`,
      recommended_action: recommendationsFor(metrics, topCrime)[0] || recommendedAction(topCrime)
    };
  }).sort((a, b) => b.risk_score - a.risk_score || b.total_crimes - a.total_crimes);
}

function policeStationRisk(records) {
  const districtGroups = groupRecords(records, "district");
  const stationGroups = records.reduce((acc, record) => {
    const key = `${record.district || "Unknown"}||${record.police_station || "Unknown"}`;
    acc[key] = acc[key] || [];
    acc[key].push(record);
    return acc;
  }, {});
  const maxVolume = Math.max(...Object.values(stationGroups).map((items) => items.length), 1);
  return Object.entries(stationGroups).map(([key, scoped]) => {
    const [district, policeStation] = key.split("||");
    const metrics = intelligenceScore(scoped, records, maxVolume);
    const topCrime = topN(scoped, "crime_type", 1)[0]?.name || "No data";
    const districtTotal = districtGroups[district]?.length || scoped.length;
    return {
      district,
      police_station: policeStation,
      risk_score: metrics.risk_score,
      risk_level: metrics.risk_level,
      total_crimes: scoped.length,
      top_crime_type: topCrime,
      heinous_count: scoped.filter(isHeinous).length,
      crime_share_in_district: percentage(scoped.length, districtTotal),
      trend_direction: metrics.trend_direction,
      explanation: `${policeStation} contributes ${percentage(scoped.length, districtTotal)}% of ${district} records.`,
      recommended_action: metrics.risk_score > 60 ? "Rebalance beat and patrol allocation for this police station." : recommendedAction(topCrime)
    };
  }).sort((a, b) => b.risk_score - a.risk_score || b.total_crimes - a.total_crimes);
}

function crimeTypeRisk(records) {
  const groups = groupRecords(records, "crime_type");
  const maxVolume = Math.max(...Object.values(groups).map((items) => items.length), 1);
  return Object.entries(groups).map(([crimeType, scoped]) => {
    const metrics = intelligenceScore(scoped, records, maxVolume);
    return {
      crime_type: crimeType,
      risk_score: metrics.risk_score,
      risk_level: metrics.risk_level,
      total_crimes: scoped.length,
      affected_districts: unique(scoped, "district").length,
      top_district: topN(scoped, "district", 1)[0]?.name || "No data",
      top_police_station: topN(scoped, "police_station", 1)[0]?.name || "No data",
      heinous_share: metrics.heinous_share,
      trend_direction: metrics.trend_direction,
      explanation: `${crimeType} appears in ${scoped.length} records across ${unique(scoped, "district").length} districts.`,
      recommended_action: recommendedAction(crimeType)
    };
  }).sort((a, b) => b.risk_score - a.risk_score || b.total_crimes - a.total_crimes);
}

function priorityZones(records) {
  return policeStationRisk(records).slice(0, 50).map((station, index) => {
    const priorityLevel = station.risk_score > 80 ? "Critical" : station.risk_score > 60 ? "High" : "Medium";
    return {
      zone_id: `zone-${index + 1}-${station.district}-${station.police_station}`.replace(/\s+/g, "-"),
      district: station.district,
      police_station: station.police_station,
      crime_type: station.top_crime_type,
      priority_level: priorityLevel,
      risk_score: station.risk_score,
      reason: station.explanation,
      immediate_action: station.recommended_action,
      resource_suggestion: priorityLevel === "Critical" ? "Immediate patrol reinforcement and senior officer review." : priorityLevel === "High" ? "Focused beat review and weekly monitoring." : "Monitor repeated pattern and improve data quality."
    };
  });
}

function riskFactorBreakdown(records) {
  const districts = districtRisk(records);
  const avg = (field) => districts.length ? Math.round(districts.reduce((sum, item) => sum + (item[field] || 0), 0) / districts.length) : 0;
  const sample = Object.values(groupRecords(records, "district")).map((scoped) => intelligenceScore(scoped, records, Math.max(...districts.map((d) => d.total_crimes), 1)).score_breakdown);
  const scoreAvg = (field) => sample.length ? Math.round(sample.reduce((sum, item) => sum + item[field], 0) / sample.length) : 0;
  const factors = [
    ["Crime Volume", scoreAvg("crime_volume"), 25, "Crime volume compared with other districts."],
    ["Heinous Crime Share", scoreAvg("heinous_crime_share"), 20, "Share of heinous or high severity records."],
    ["Trend Growth", scoreAvg("trend_growth"), 15, "Recent month growth compared with earlier periods."],
    ["Police Station Concentration", scoreAvg("police_station_concentration"), 15, "Risk from cases concentrated in a few stations."],
    ["Legal Resolution Gap", scoreAvg("legal_resolution_gap"), 10, "Gap between accused, arrests, and convictions."],
    ["FIR Stage Pending Pressure", scoreAvg("fir_stage_pending"), 10, "Pending FIR stage pressure across records."],
    ["Data Confidence", scoreAvg("data_confidence"), 5, "Completeness and coordinate availability."]
  ];
  return factors.map(([factor_name, score, weight, explanation]) => ({ factor_name, score, weight, level: riskLevel(score), explanation }));
}

function interventionPlan(records) {
  const zones = priorityZones(records).slice(0, 20);
  const plans = zones.map((zone) => ({
    priority: zone.priority_level,
    title: `${zone.crime_type} intervention in ${zone.police_station}`,
    district: zone.district,
    police_station: zone.police_station,
    crime_type: zone.crime_type,
    action: zone.immediate_action,
    reason: zone.reason,
    expected_impact: "Reduced operational pressure through targeted prevention and case follow-up.",
    timeline: zone.priority_level === "Critical" ? "Immediate 24-72 hours" : zone.priority_level === "High" ? "This week" : "Next review cycle"
  }));
  if (records.filter(coordinatesAvailable).length / Math.max(records.length, 1) < 0.4) {
    plans.push({
      priority: "Medium",
      title: "Improve FIR geotagging",
      district: "Statewide",
      police_station: "All",
      crime_type: "Data Quality",
      action: "Mandate geotagging during FIR entry.",
      reason: "Low coordinate availability reduces spatial risk confidence.",
      expected_impact: "Better hotspot precision and deployment planning.",
      timeline: "Next data review cycle"
    });
  }
  return plans;
}

function riskIntelligenceSummary(records) {
  const districts = districtRisk(records);
  const stations = policeStationRisk(records);
  const crimes = crimeTypeRisk(records);
  const scores = [...districts.map((item) => item.risk_score), ...stations.slice(0, 50).map((item) => item.risk_score)];
  return {
    total_records_analyzed: records.length,
    total_districts: unique(records, "district").length,
    total_police_stations: unique(records, "police_station").length,
    critical_zones: [...districts, ...stations].filter((item) => item.risk_level === "Critical").length,
    high_risk_zones: [...districts, ...stations].filter((item) => item.risk_level === "High").length,
    highest_risk_district: districts[0]?.district || "No data",
    highest_risk_police_station: stations[0]?.police_station || "No data",
    highest_risk_crime_type: crimes[0]?.crime_type || "No data",
    average_risk_score: scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length) : 0,
    generated_at: new Date().toISOString()
  };
}

function whyRisk(metrics, districtRecords) {
  const reasons = [];
  if (metrics.volumeScore > 15) reasons.push("Crime volume is higher than district average.");
  if (metrics.heinousScore > 8) reasons.push("Heinous crime share is high.");
  if (metrics.trend_direction === "Increasing") reasons.push("Recent crime trend is increasing compared with the previous period.");
  if (metrics.concentrationScore > 6) reasons.push("A single police station contributes a large share of cases.");
  if (metrics.gapScore > 5) reasons.push("Conviction or arrest gap is significant compared with accused count.");
  if (metrics.coordinate_available_percentage < 50) reasons.push("Coordinate availability is low, reducing spatial confidence.");
  if (!reasons.length && districtRecords.length > 0) reasons.push("Risk is primarily driven by current crime volume and distribution patterns.");
  return reasons;
}

function recommendationsFor(metrics, topCrimeName) {
  const recommendations = [recommendedAction(topCrimeName)];
  if (metrics.heinousScore > 8) recommendations.push("Prioritize high-visibility policing for high-severity cases.");
  if (metrics.conviction_rate < 20) recommendations.push("Strengthen evidence tracking and case follow-up.");
  if (metrics.coordinate_available_percentage < 50) recommendations.push("Improve FIR geotagging for better hotspot accuracy.");
  if (metrics.concentrationScore > 6) recommendations.push("Review police station-level deployment and beat allocation.");
  return [...new Set(recommendations)];
}

function buildDna(allRecords, filteredRecords, district) {
  const districtRecords = filteredRecords.filter((record) => record.district === district);
  const metrics = riskMetrics(allRecords, districtRecords);
  const topCrime = topN(districtRecords, "crime_type", 1)[0];
  const topHead = topN(districtRecords, "crime_subtype", 1)[0];
  const topStation = topN(districtRecords, "police_station", 1)[0];
  const monthly = getMonthlyTrend(districtRecords);
  const peak = monthly.reduce((best, item) => (item.count > (best?.count || 0) ? item : best), null);
  const victims = districtRecords.reduce((sum, record) => sum + number(record.victim_count), 0);
  const accused = districtRecords.reduce((sum, record) => sum + number(record.accused_count), 0);
  const arrested = districtRecords.reduce((sum, record) => sum + number(record.arrested_count), 0);
  const convictions = districtRecords.reduce((sum, record) => sum + number(record.conviction_count), 0);
  const recommendations = recommendationsFor(metrics, topCrime?.name || "");

  return {
    district,
    risk_score: metrics.risk_score,
    risk_level: metrics.risk_level,
    confidence_score: metrics.confidence_score,
    total_crimes: districtRecords.length,
    heinous_crimes: districtRecords.filter(isHeinous).length,
    non_heinous_crimes: districtRecords.filter(isNonHeinous).length,
    dominant_crime_type: topCrime?.name || "No data",
    dominant_crime_head: topHead?.name || "No data",
    peak_month: peak?.period || "No data",
    top_police_station: topStation?.name || "No data",
    trend_direction: metrics.trend_direction,
    victim_count: victims,
    accused_count: accused,
    arrested_count: arrested,
    conviction_count: convictions,
    arrest_rate: metrics.arrest_rate,
    conviction_rate: metrics.conviction_rate,
    coordinate_available_percentage: metrics.coordinate_available_percentage,
    why_this_risk: whyRisk(metrics, districtRecords),
    top_crime_groups: topN(districtRecords, "crime_type", 5),
    top_crime_heads: topN(districtRecords, "crime_subtype", 5),
    monthly_trend: monthly,
    police_station_ranking: topN(districtRecords, "police_station", 10),
    fir_stage_distribution: topN(districtRecords, "fir_stage", 10),
    complaint_mode_distribution: topN(districtRecords, "complaint_mode", 10),
    recommendations,
    district_crime_twin: {
      crime_personality_summary: `${district} is primarily shaped by ${topCrime?.name || "mixed crime"} records with ${topHead?.name || "multiple crime heads"} as a leading head.`,
      main_risk_pattern: `${topStation?.name || "Multiple police stations"} contributes the strongest police-station signal.`,
      operational_priority: metrics.risk_level === "Critical" || metrics.risk_level === "High" ? "Immediate targeted prevention, high-visibility patrol, and investigation follow-up." : "Sustained monitoring, data quality improvement, and preventive patrol.",
      prevention_strategy: recommendations[0] || "Maintain surveillance and review district-level trends."
    },
    score_breakdown: {
      crime_volume_score: metrics.volumeScore,
      heinous_crime_score: metrics.heinousScore,
      recent_trend_score: metrics.trendScore,
      crime_concentration_score: metrics.concentrationScore,
      arrest_conviction_gap_score: metrics.gapScore,
      data_confidence_score: metrics.dataConfidenceScore
    }
  };
}

function listDistricts(allRecords, filteredRecords) {
  return unique(filteredRecords, "district")
    .map((district) => {
      const profile = buildDna(allRecords, filteredRecords, district);
      return {
        district,
        total_crimes: profile.total_crimes,
        risk_score: profile.risk_score,
        risk_level: profile.risk_level
      };
    })
    .sort((a, b) => b.risk_score - a.risk_score || b.total_crimes - a.total_crimes);
}

const decodeDistrict = (path, prefix) => decodeURIComponent(path.replace(prefix, "")).trim();

module.exports = async (req, res) => {
  const path = getPath(req, SERVICE_NAME);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI risk-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (req.method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const allRecords = await fetchCrimeRecords(app);
    const params = getQuery(req);
    const filteredRecords = applyFilters(allRecords, params);

    if (req.method === "GET" && path === "/risk-intelligence/summary") return send(res, 200, { success: true, data: riskIntelligenceSummary(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/district-risk") return send(res, 200, { success: true, data: districtRisk(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/police-station-risk") return send(res, 200, { success: true, data: policeStationRisk(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/crime-type-risk") return send(res, 200, { success: true, data: crimeTypeRisk(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/priority-zones") return send(res, 200, { success: true, data: priorityZones(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/risk-factors") return send(res, 200, { success: true, data: riskFactorBreakdown(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/intervention-plan") return send(res, 200, { success: true, data: interventionPlan(filteredRecords) });
    if (req.method === "GET" && path === "/risk-intelligence/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });

    if (req.method === "GET" && path === "/risk/districts") return send(res, 200, { success: true, data: listDistricts(allRecords, filteredRecords) });
    if (req.method === "GET" && path === "/risk/summary") {
      const districts = listDistricts(allRecords, filteredRecords);
      return send(res, 200, {
        success: true,
        data: {
          total_districts: districts.length,
          total_records: filteredRecords.length,
          high_risk_districts: districts.filter((item) => item.risk_level === "High" || item.risk_level === "Critical").length,
          top_district: districts[0] || null,
          districts
        }
      });
    }
    if (req.method === "GET" && path.startsWith("/risk/dna/")) return send(res, 200, { success: true, data: buildDna(allRecords, filteredRecords, decodeDistrict(path, "/risk/dna/")) });
    if (req.method === "GET" && path.startsWith("/risk/score/")) {
      const district = decodeDistrict(path, "/risk/score/");
      const profile = buildDna(allRecords, filteredRecords, district);
      return send(res, 200, { success: true, data: { district, risk_score: profile.risk_score, risk_level: profile.risk_level, confidence_score: profile.confidence_score, score_breakdown: profile.score_breakdown } });
    }
    if (req.method === "GET" && path.startsWith("/risk/why/")) return send(res, 200, { success: true, data: buildDna(allRecords, filteredRecords, decodeDistrict(path, "/risk/why/")).why_this_risk });
    if (req.method === "GET" && path.startsWith("/risk/recommendations/")) return send(res, 200, { success: true, data: buildDna(allRecords, filteredRecords, decodeDistrict(path, "/risk/recommendations/")).recommendations });
    if (req.method === "GET" && path === "/risk/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });
    return send(res, 404, { success: false, message: "Route not found", method: req.method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[risk-api] request failed", error);
    return send(res, 500, { success: false, message: "Risk API failed", error: error.message, details: error.toString(), path, stack: error.stack });
  }
};
