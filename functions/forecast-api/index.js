const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  getMonthlyTrend,
  hasCoordinates,
  isHeinous,
  recommendedAction,
  topN,
  toNumber,
  unique
} = require("./crimeAnalytics");

const SERVICE_NAME = "forecast-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /forecast/summary",
  "GET /forecast/today",
  "GET /forecast/tomorrow",
  "GET /forecast/next-7-days",
  "GET /forecast/districts",
  "GET /forecast/district/:district",
  "GET /forecast/crime-types",
  "GET /forecast/risk-calendar",
  "GET /forecast/recommendations",
  "GET /forecast/filters"
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

function query(req) {
  return Object.fromEntries(new URL(req.url || "/", `https://${req.headers.host || "catalyst.local"}`).searchParams.entries());
}

function clean(value) {
  return String(value ?? "").trim();
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function periodOf(record) {
  const year = clean(record.fir_year);
  const month = clean(record.fir_month);
  return year && month ? `${year}-${String(month).padStart(2, "0")}` : "Unknown";
}

function trend(records) {
  const monthly = getMonthlyTrend(records).filter((item) => item.period !== "Unknown");
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.slice(-4, -1);
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest;
  return {
    latest,
    previousAverage,
    direction: latest > previousAverage * 1.1 ? "Increasing" : latest < previousAverage * 0.9 ? "Decreasing" : "Stable",
    trendRatio: latest / Math.max(previousAverage, 1)
  };
}

function confidence(records) {
  if (!records.length) return 0;
  const required = records.filter((record) => clean(record.district) && clean(record.police_station) && clean(record.crime_type) && clean(record.fir_year) && clean(record.fir_month)).length;
  return Math.round(pct(required, records.length) * 0.75 + pct(records.filter(hasCoordinates).length, records.length) * 0.25);
}

function scoreRecords(records, allRecords) {
  if (!records.length) return { score: 0, predictedVolume: 0, confidenceScore: 0 };
  const averageVolume = allRecords.length / Math.max(unique(allRecords, "district").length || 1, 1);
  const volumeScore = Math.min(30, (records.length / Math.max(averageVolume, 1)) * 20);
  const tr = trend(records);
  const trendScore = Math.min(25, tr.trendRatio * 12);
  const topMonthShare = pct(topN(records, "fir_month", 1)[0]?.value || 0, records.length);
  const seasonalScore = Math.min(15, topMonthShare * 0.3);
  const heinousScore = pct(records.filter(isHeinous).length, records.length) * 0.1;
  const stationShare = pct(topN(records, "police_station", 1)[0]?.value || 0, records.length);
  const concentrationScore = Math.min(10, stationShare * 0.2);
  const confidenceScore = confidence(records);
  const dataScore = confidenceScore * 0.1;
  const score = Math.round(Math.min(100, volumeScore + trendScore + seasonalScore + heinousScore + concentrationScore + dataScore));
  return {
    score,
    predictedVolume: Math.max(1, Math.round((tr.latest || records.length / Math.max(getMonthlyTrend(records).length, 1)) * (score / 55))),
    confidenceScore
  };
}

function forecastFor(records, allRecords, options = {}) {
  const { score, predictedVolume, confidenceScore } = scoreRecords(records, allRecords);
  const topCrimes = topN(records, "crime_type", 3).map((item) => item.name);
  const topCrime = topCrimes[0] || "No data";
  const topDistrict = options.district || topN(records, "district", 1)[0]?.name || "Karnataka";
  const topStation = topN(records, "police_station", 1)[0]?.name || "No data";
  const tr = trend(records);
  const peak = getMonthlyTrend(records).reduce((best, item) => item.count > (best?.count || 0) ? item : best, null);
  const date = new Date();
  date.setDate(date.getDate() + Number(options.daysAhead || 0));
  const dateLabel = options.label || "Forecast";
  return {
    forecast_id: options.forecast_id || `${dateLabel}-${topDistrict}`.replace(/\s+/g, "-"),
    district: topDistrict,
    forecast_date: date.toISOString().slice(0, 10),
    forecast_label: dateLabel,
    date_label: dateLabel,
    risk_score: score,
    risk_level: riskLevel(score),
    confidence_score: confidenceScore,
    predicted_crime_volume: predictedVolume,
    predicted_volume: predictedVolume,
    expected_crime_types: topCrimes,
    expected_concern: topCrime,
    peak_risk_period: peak?.period || "No data",
    top_police_station: topStation,
    main_reason: `Forecast uses historical volume, recent FIR month trend, seasonality, heinous share, and police station concentration.`,
    explanation: `Risk is ${riskLevel(score)} because ${topCrime} is dominant, trend is ${tr.direction}, and ${topStation} is the leading police station.`,
    why_this_forecast: [
      `Records analyzed: ${records.length}`,
      `Dominant crime type: ${topCrime}`,
      `Recent trend: ${tr.direction}`,
      `Top police station: ${topStation}`,
      `Confidence score: ${confidenceScore}%`
    ],
    recommended_action: recommendedAction(topCrime),
    recommended_actions: [
      recommendedAction(topCrime),
      "Review beat deployment in high-volume police stations.",
      "Use this forecast as a risk indicator, not a guaranteed event prediction."
    ],
    trend_direction: tr.direction,
    expected_crime_count: predictedVolume,
    high_severity_probability: pct(records.filter(isHeinous).length, records.length)
  };
}

function dayForecast(records, allRecords, daysAhead) {
  const base = forecastFor(records, allRecords, {
    daysAhead,
    label: daysAhead === 0 ? "Today" : daysAhead === 1 ? "Tomorrow" : `Day ${daysAhead}`,
    forecast_id: `day-${daysAhead}`
  });
  const adjustment = daysAhead === 1 ? 2 : daysAhead % 3;
  return {
    ...base,
    risk_score: Math.min(100, base.risk_score + adjustment),
    risk_level: riskLevel(Math.min(100, base.risk_score + adjustment)),
    top_risk_districts: topN(records, "district", 5),
    top_risk_crime_types: topN(records, "crime_type", 5),
    likely_police_stations: topN(records, "police_station", 5).map((item) => item.name)
  };
}

function districtForecasts(records, allRecords) {
  return topN(records, "district", 50).map((districtItem, index) => {
    const scoped = records.filter((record) => record.district === districtItem.name);
    const forecast = forecastFor(scoped, allRecords, { district: districtItem.name, label: "District Forecast", forecast_id: `district-${index}-${districtItem.name}` });
    return {
      ...forecast,
      top_crime_type: forecast.expected_concern,
      explanation: forecast.explanation,
      recommended_action: forecast.recommended_action
    };
  }).sort((a, b) => b.risk_score - a.risk_score);
}

function detailedDistrictForecast(records, allRecords, district) {
  const scoped = records.filter((record) => record.district === district);
  const base = forecastFor(scoped, allRecords, { district, label: "District Detail", forecast_id: `district-detail-${district}` });
  return {
    ...base,
    risk_score: base.risk_score,
    risk_level: base.risk_level,
    predicted_volume: base.predicted_crime_volume,
    peak_months: topN(scoped, "fir_month", 3).map((item) => item.name),
    dominant_crime_types: topN(scoped, "crime_type", 5),
    dominant_police_stations: topN(scoped, "police_station", 5),
    heinous_share: pct(scoped.filter(isHeinous).length, scoped.length),
    trend_direction: base.trend_direction,
    confidence_score: base.confidence_score,
    explanation: base.explanation,
    recommended_actions: base.recommended_actions,
    seven_day_forecast: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      date_label: `Day ${index + 1}`,
      risk_score: Math.min(100, base.risk_score + (index % 3)),
      risk_level: riskLevel(Math.min(100, base.risk_score + (index % 3))),
      predicted_crime_volume: Math.max(1, base.predicted_crime_volume + (index % 2)),
      top_risk_district: district,
      top_risk_crime_type: base.expected_concern,
      confidence_score: base.confidence_score,
      recommendation: base.recommended_action
    }))
  };
}

function crimeTypeForecasts(records, allRecords) {
  return topN(records, "crime_type", 30).map((crimeItem, index) => {
    const scoped = records.filter((record) => record.crime_type === crimeItem.name);
    const scored = scoreRecords(scoped, allRecords);
    return {
      forecast_id: `crime-type-${index}-${crimeItem.name}`.replace(/\s+/g, "-"),
      crime_type: crimeItem.name,
      risk_score: scored.score,
      risk_level: riskLevel(scored.score),
      predicted_volume: scored.predictedVolume,
      predicted_crime_volume: scored.predictedVolume,
      affected_districts: topN(scoped, "district", 5).map((item) => item.name),
      peak_month: topN(scoped, "fir_month", 1)[0]?.name || "No data",
      confidence_score: scored.confidenceScore,
      recommended_action: recommendedAction(crimeItem.name),
      name: crimeItem.name,
      value: scored.score
    };
  }).sort((a, b) => b.risk_score - a.risk_score);
}

function riskCalendar(records, allRecords) {
  const average = records.length / 12;
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1);
    const scoped = records.filter((record) => clean(record.fir_month) === month);
    const score = Math.round(Math.min(100, (scoped.length / Math.max(average, 1)) * 45 + pct(scoped.filter(isHeinous).length, scoped.length) * 0.2));
    return {
      month,
      risk_score: score,
      risk_level: riskLevel(score),
      predicted_volume: Math.max(0, Math.round(scoped.length / Math.max(unique(scoped, "fir_year").length || 1, 1))),
      top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
      top_district: topN(scoped, "district", 1)[0]?.name || "No data"
    };
  });
}

function recommendations(records) {
  const recs = [];
  topN(records, "crime_type", 6).forEach((item, index) => {
    const scoped = records.filter((record) => record.crime_type === item.name);
    recs.push({
      priority: index < 2 ? "High" : "Medium",
      title: `${item.name} prevention focus`,
      district: topN(scoped, "district", 1)[0]?.name || "Karnataka",
      crime_type: item.name,
      action: recommendedAction(item.name),
      reason: `${item.name} appears in ${item.value} historical records.`,
      confidence_score: confidence(scoped)
    });
  });
  const lowCoordinates = pct(records.filter(hasCoordinates).length, records.length) < 40;
  if (lowCoordinates) {
    recs.push({
      priority: "Medium",
      title: "Improve FIR geotagging",
      district: "Statewide",
      crime_type: "Data Quality",
      action: "Improve FIR geotagging for future predictive accuracy.",
      reason: "Coordinate availability is below 40%.",
      confidence_score: 90
    });
  }
  const accused = records.reduce((sum, record) => sum + toNumber(record.accused_count), 0);
  const convictions = records.reduce((sum, record) => sum + toNumber(record.conviction_count), 0);
  if (accused > 0 && pct(convictions, accused) < 10) {
    recs.push({
      priority: "High",
      title: "Strengthen evidence tracking",
      district: topN(records, "district", 1)[0]?.name || "Karnataka",
      crime_type: topN(records, "crime_type", 1)[0]?.name || "Crime",
      action: "Strengthen evidence tracking and case follow-up.",
      reason: `Conviction rate is ${pct(convictions, accused)}% against accused count.`,
      confidence_score: 85
    });
  }
  return recs;
}

function summary(records, allRecords) {
  const districts = districtForecasts(records, allRecords);
  const crimeTypes = crimeTypeForecasts(records, allRecords);
  const overall = dayForecast(records, allRecords, 0);
  return {
    total_records_analyzed: records.length,
    forecast_confidence: overall.confidence_score,
    highest_risk_district: districts[0]?.district || "No data",
    highest_risk_crime_type: crimeTypes[0]?.crime_type || "No data",
    overall_risk_level: overall.risk_level,
    forecast_window: "Today, tomorrow, and next 7 days",
    generated_at: new Date().toISOString(),
    model_type: "Rule-based historical risk forecast",
    today_overall_risk: overall.risk_level,
    expected_concern: overall.expected_concern,
    last_updated_time: new Date().toISOString(),
    risk_distribution: Object.values(districts.reduce((acc, item) => {
      acc[item.risk_level] = acc[item.risk_level] || { name: item.risk_level, value: 0 };
      acc[item.risk_level].value += 1;
      return acc;
    }, {})),
    total_records_used: records.length,
    districts_covered: unique(records, "district").length,
    top_districts: topN(records, "district", 5)
  };
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[forecast-api] method:", method);
  console.log("[forecast-api] raw url:", req.url);
  console.log("[forecast-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI forecast-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const params = query(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);

    if (method === "GET" && path === "/forecast/summary") return send(res, 200, { success: true, data: summary(records, allRecords) });
    if (method === "GET" && path === "/forecast/today") return send(res, 200, { success: true, data: dayForecast(records, allRecords, 0) });
    if (method === "GET" && path === "/forecast/tomorrow") return send(res, 200, { success: true, data: dayForecast(records, allRecords, 1) });
    if (method === "GET" && path === "/forecast/next-7-days") {
      return send(res, 200, {
        success: true,
        data: Array.from({ length: 7 }, (_, index) => {
          const item = dayForecast(records, allRecords, index + 1);
          return {
            ...item,
            day: index + 1,
            date_label: `Day ${index + 1}`,
            top_risk_district: topN(records, "district", 1)[0]?.name || "No data",
            top_risk_crime_type: item.expected_concern,
            recommendation: item.recommended_action
          };
        })
      });
    }
    if (method === "GET" && path === "/forecast/districts") return send(res, 200, { success: true, data: districtForecasts(records, allRecords) });
    if (method === "GET" && path.startsWith("/forecast/district/")) {
      const district = decodeURIComponent(path.replace("/forecast/district/", "")).trim();
      return send(res, 200, { success: true, data: detailedDistrictForecast(records, allRecords, district) });
    }
    if (method === "GET" && path === "/forecast/crime-types") return send(res, 200, { success: true, data: crimeTypeForecasts(records, allRecords) });
    if (method === "GET" && path === "/forecast/risk-calendar") return send(res, 200, { success: true, data: riskCalendar(records, allRecords) });
    if (method === "GET" && path === "/forecast/recommendations") return send(res, 200, { success: true, data: recommendations(records) });
    if (method === "GET" && path === "/forecast/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[forecast-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Forecast API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
