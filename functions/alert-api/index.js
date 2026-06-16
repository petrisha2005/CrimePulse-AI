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

const SERVICE_NAME = "alert-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /alerts",
  "GET /alerts/summary",
  "GET /alerts/anomalies",
  "GET /alerts/pattern-whispers",
  "GET /alerts/charts",
  "GET /alerts/filters"
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

function getQuery(req) {
  return Object.fromEntries(new URL(req.url || "/", `https://${req.headers.host || "catalyst.local"}`).searchParams.entries());
}

function clean(value) {
  return String(value ?? "").trim();
}

function percentage(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function severityFromIncrease(increase, forceHighSeverity = false) {
  if (forceHighSeverity || increase >= 200) return "Critical";
  if (increase >= 100) return "High";
  if (increase >= 50) return "Medium";
  return "Low";
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

function scopeLabel(records) {
  const district = topN(records, "district", 1)[0]?.name || "Karnataka";
  const station = topN(records, "police_station", 1)[0]?.name || "";
  const crimeType = topN(records, "crime_type", 1)[0]?.name || "Crime";
  return { district, station, crimeType };
}

function alertId(prefix, parts) {
  return `${prefix}-${parts.map((part) => clean(part).toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-")}-${Date.now()}`.replace(/-+/g, "-");
}

function createAlert({
  alert_type,
  title,
  district,
  police_station = "",
  crime_type = "Unknown",
  severity = "Medium",
  increase_percentage = 0,
  current_value = 0,
  expected_value = 0,
  time_period = "Current dataset",
  explanation,
  recommended_action
}) {
  return {
    alert_id: alertId(alert_type, [district, police_station, crime_type, time_period]),
    alert_type,
    title,
    district: district || "Karnataka",
    police_station,
    crime_type,
    severity,
    increase_percentage: Math.max(0, Math.round(increase_percentage)),
    current_value: Math.round(current_value),
    expected_value: Math.round(expected_value),
    time_period,
    explanation,
    recommended_action: recommended_action || recommendedAction(crime_type),
    detected_at: new Date().toISOString()
  };
}

function latestMonthlyComparison(records) {
  const monthly = getMonthlyTrend(records).filter((item) => item.period !== "Unknown");
  if (monthly.length < 2) return null;
  const latest = monthly.at(-1);
  const previous = monthly.at(-2);
  const current = latest?.count || 0;
  const expected = previous?.count || 0;
  const increase = expected > 0 ? ((current - expected) / expected) * 100 : (current > 0 ? 100 : 0);
  return { current, expected, increase, period: latest.period, previousPeriod: previous.period };
}

function addSpikeAlerts(alerts, records) {
  const scopes = [
    { key: "state", label: "Karnataka", records },
    ...topN(records, "district", 25).map((item) => ({
      key: `district-${item.name}`,
      label: item.name,
      records: records.filter((record) => record.district === item.name)
    }))
  ];

  scopes.forEach((scope) => {
    const comparison = latestMonthlyComparison(scope.records);
    if (!comparison || comparison.increase < 50) return;
    const { district, station, crimeType } = scopeLabel(scope.records);
    alerts.push(createAlert({
      alert_type: "Sudden Crime Spike",
      title: `${crimeType} spike detected in ${scope.label}`,
      district: scope.key === "state" ? district : scope.label,
      police_station: station,
      crime_type: crimeType,
      severity: severityFromIncrease(comparison.increase),
      increase_percentage: comparison.increase,
      current_value: comparison.current,
      expected_value: comparison.expected,
      time_period: comparison.period,
      explanation: `Latest FIR month ${comparison.period} has ${comparison.current} cases compared with ${comparison.expected} cases in ${comparison.previousPeriod}.`,
      recommended_action: recommendedAction(crimeType)
    }));
  });
}

function addHeinousAlerts(alerts, records) {
  topN(records, "district", 25).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    const heinous = districtRecords.filter(isHeinous).length;
    const share = percentage(heinous, districtRecords.length);
    if (districtRecords.length < 10 || share <= 20) return;
    const topCrime = topN(districtRecords.filter(isHeinous), "crime_type", 1)[0]?.name || topN(districtRecords, "crime_type", 1)[0]?.name || "Heinous Crime";
    alerts.push(createAlert({
      alert_type: "Heinous Crime Spike",
      title: `High heinous crime share in ${districtItem.name}`,
      district: districtItem.name,
      police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
      crime_type: topCrime,
      severity: share >= 35 ? "Critical" : "High",
      increase_percentage: share,
      current_value: heinous,
      expected_value: Math.round(districtRecords.length * 0.2),
      time_period: "Current filtered dataset",
      explanation: `${share}% of records in ${districtItem.name} are heinous or high severity.`,
      recommended_action: recommendedAction(topCrime)
    }));
  });
}

function addConcentrationAlerts(alerts, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    if (districtRecords.length < 10) return;

    const topStation = topN(districtRecords, "police_station", 1)[0];
    const stationShare = percentage(topStation?.value || 0, districtRecords.length);
    if (topStation && stationShare > 35) {
      const stationRecords = districtRecords.filter((record) => record.police_station === topStation.name);
      const topCrime = topN(stationRecords, "crime_type", 1)[0]?.name || "Crime";
      alerts.push(createAlert({
        alert_type: "Police Station Concentration",
        title: `${topStation.name} contributes ${stationShare}% of ${districtItem.name} cases`,
        district: districtItem.name,
        police_station: topStation.name,
        crime_type: topCrime,
        severity: stationShare >= 55 ? "High" : "Medium",
        increase_percentage: stationShare,
        current_value: topStation.value,
        expected_value: Math.round(districtRecords.length * 0.35),
        time_period: "Current filtered dataset",
        explanation: `One police station is contributing more than 35% of district crime volume.`,
        recommended_action: "Review police station-level deployment and beat allocation."
      }));
    }

    const topCrime = topN(districtRecords, "crime_type", 1)[0];
    const crimeShare = percentage(topCrime?.value || 0, districtRecords.length);
    if (topCrime && crimeShare > 40) {
      alerts.push(createAlert({
        alert_type: "Crime Type Concentration",
        title: `${topCrime.name} dominates crime pattern in ${districtItem.name}`,
        district: districtItem.name,
        police_station: topStation?.name || "",
        crime_type: topCrime.name,
        severity: crimeShare >= 60 ? "High" : "Medium",
        increase_percentage: crimeShare,
        current_value: topCrime.value,
        expected_value: Math.round(districtRecords.length * 0.4),
        time_period: "Current filtered dataset",
        explanation: `${topCrime.name} contributes ${crimeShare}% of filtered records in this district.`,
        recommended_action: recommendedAction(topCrime.name)
      }));
    }
  });
}

function addInvestigationAlerts(alerts, records) {
  topN(records, "district", 25).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    const accused = districtRecords.reduce((sum, record) => sum + toNumber(record.accused_count), 0);
    const convictions = districtRecords.reduce((sum, record) => sum + toNumber(record.conviction_count), 0);
    const convictionRate = percentage(convictions, accused);
    if (accused >= 20 && convictionRate < 10) {
      const topCrime = topN(districtRecords, "crime_type", 1)[0]?.name || "Investigation Follow-up";
      alerts.push(createAlert({
        alert_type: "Low Conviction Gap",
        title: `Low conviction gap detected in ${districtItem.name}`,
        district: districtItem.name,
        police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
        crime_type: topCrime,
        severity: accused >= 100 ? "High" : "Medium",
        increase_percentage: Math.max(0, 100 - convictionRate),
        current_value: convictions,
        expected_value: Math.ceil(accused * 0.1),
        time_period: "Current filtered dataset",
        explanation: `Conviction rate is ${convictionRate}% against ${accused} accused records.`,
        recommended_action: "Strengthen evidence collection and case monitoring."
      }));
    }

    const pending = districtRecords.filter((record) => clean(record.fir_stage).toLowerCase().includes("pending")).length;
    const pendingShare = percentage(pending, districtRecords.length);
    if (districtRecords.length >= 10 && pendingShare > 20) {
      const topCrime = topN(districtRecords, "crime_type", 1)[0]?.name || "Pending FIR";
      alerts.push(createAlert({
        alert_type: "Pending FIR Stage",
        title: `Pending FIR stage load is high in ${districtItem.name}`,
        district: districtItem.name,
        police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
        crime_type: topCrime,
        severity: pendingShare >= 45 ? "High" : "Medium",
        increase_percentage: pendingShare,
        current_value: pending,
        expected_value: Math.round(districtRecords.length * 0.2),
        time_period: "Current filtered dataset",
        explanation: `${pendingShare}% of records are still marked with a pending FIR stage.`,
        recommended_action: "Review case progress and strengthen investigation follow-up."
      }));
    }
  });
}

function addDataQualityAlerts(alerts, records) {
  topN(records, "district", 30).forEach((districtItem) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    if (districtRecords.length < 10) return;
    const withCoordinates = districtRecords.filter(hasCoordinates).length;
    const coordinateShare = percentage(withCoordinates, districtRecords.length);
    if (coordinateShare >= 40) return;
    alerts.push(createAlert({
      alert_type: "Location Missing Data Alert",
      title: `Low coordinate availability in ${districtItem.name}`,
      district: districtItem.name,
      police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
      crime_type: "Data Quality",
      severity: coordinateShare < 20 ? "Medium" : "Low",
      increase_percentage: Math.max(0, 40 - coordinateShare),
      current_value: withCoordinates,
      expected_value: Math.ceil(districtRecords.length * 0.4),
      time_period: "Current filtered dataset",
      explanation: `Only ${coordinateShare}% of records have both latitude_value and longitude_value.`,
      recommended_action: "Improve FIR geotagging and data quality checks."
    }));
  });
}

function detectAlerts(records, params = {}) {
  if (!records.length) return [];
  const alerts = [];
  addSpikeAlerts(alerts, records);
  addHeinousAlerts(alerts, records);
  addConcentrationAlerts(alerts, records);
  addInvestigationAlerts(alerts, records);
  addDataQualityAlerts(alerts, records);

  const alertType = clean(params.alert_type).toLowerCase();
  return alerts
    .filter((alert) => !alertType || alertType === "all" || alert.alert_type.toLowerCase() === alertType)
    .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.current_value - a.current_value)
    .slice(0, 100);
}

function summarizeAlerts(alerts) {
  const commonType = countBy(alerts, "alert_type")[0]?.name || "No active alerts";
  const critical = alerts.filter((alert) => alert.severity === "Critical").length;
  const high = alerts.filter((alert) => alert.severity === "High").length;
  const medium = alerts.filter((alert) => alert.severity === "Medium").length;
  const districts = new Set(alerts.map((alert) => alert.district).filter(Boolean)).size;
  const latest = alerts.map((alert) => alert.detected_at).sort().at(-1) || "";
  return {
    total_active_alerts: alerts.length,
    critical_alerts: critical,
    high_alerts: high,
    medium_alerts: medium,
    districts_with_alerts: districts,
    high_risk_districts: new Set(alerts.filter((alert) => ["Critical", "High"].includes(alert.severity)).map((alert) => alert.district).filter(Boolean)).size,
    most_common_alert_type: commonType,
    latest_alert_time: latest,
    totalActiveAlerts: alerts.length,
    criticalAlerts: critical,
    highAlerts: high,
    mediumAlerts: medium,
    districtsWithAlerts: districts,
    highRiskDistricts: new Set(alerts.filter((alert) => ["Critical", "High"].includes(alert.severity)).map((alert) => alert.district).filter(Boolean)).size,
    mostCommonAlertType: commonType,
    latestAlertTime: latest
  };
}

function buildWhispers(alerts) {
  return alerts.slice(0, 5).map((alert) => {
    if (alert.alert_type === "Location Missing Data Alert") return `Location data quality needs attention in ${alert.district}.`;
    if (alert.alert_type === "Police Station Concentration") return `Crime concentration detected around ${alert.police_station} in ${alert.district}.`;
    if (alert.crime_type.toLowerCase().includes("cyber") || alert.crime_type.toLowerCase().includes("fraud")) return `Cybercrime or financial fraud anomaly detected in ${alert.district}.`;
    if (alert.crime_type.toLowerCase().includes("theft")) return `Theft pattern rising in ${alert.district}.`;
    if (alert.crime_type.toLowerCase().includes("burglary")) return `Night burglary risk increasing in ${alert.district}.`;
    return `${alert.crime_type} red-zone signal detected in ${alert.district}.`;
  });
}

function buildCharts(alerts, records) {
  const monthlyTrend = getMonthlyTrend(records).slice(-12).map((item) => ({ name: item.period, value: item.count, count: item.count }));
  return {
    crimeSpikeComparison: alerts.slice(0, 10).map((alert) => ({ name: alert.district, current: alert.current_value, expected: alert.expected_value })),
    districtAnomalyCount: countBy(alerts, "district").slice(0, 10),
    alertSeverityDistribution: countBy(alerts, "severity"),
    alertsByCrimeType: countBy(alerts, "crime_type").slice(0, 10),
    monthlyAnomalyTrend: monthlyTrend,
    spikeComparison: alerts.slice(0, 10).map((alert) => ({ name: alert.district, current: alert.current_value, expected: alert.expected_value })),
    districtAnomalyCounts: countBy(alerts, "district").slice(0, 10),
    severityDistribution: countBy(alerts, "severity")
  };
}

function buildFilterOptions(records, alerts) {
  const options = filterOptions(records);
  const alertTypes = [...new Set([
    "Sudden Crime Spike",
    "Heinous Crime Spike",
    "Police Station Concentration",
    "Crime Type Concentration",
    "Low Conviction Gap",
    "Location Missing Data Alert",
    "Pending FIR Stage",
    ...alerts.map((alert) => alert.alert_type)
  ])].sort();
  return {
    ...options,
    alertTypes,
    alert_type: alertTypes
  };
}

function toAnomaly(alert) {
  return {
    ...alert,
    anomaly_id: alert.alert_id,
    anomaly_type: alert.alert_type,
    current_count: alert.current_value,
    historical_average: alert.expected_value,
    expected_count: alert.expected_value,
    suggested_action: alert.recommended_action,
    detected_date: alert.detected_at
  };
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[alert-api] method:", method);
  console.log("[alert-api] raw url:", req.url);
  console.log("[alert-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") {
    return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI alert-api is running", availableRoutes: AVAILABLE_ROUTES });
  }
  if (method === "GET" && path === "/health") {
    return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });
  }

  try {
    const app = catalyst.initialize(req);
    const params = getQuery(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);
    const alerts = detectAlerts(records, params);

    if (method === "GET" && path === "/alerts") return send(res, 200, { success: true, data: alerts });
    if (method === "GET" && path === "/alerts/anomalies") return send(res, 200, { success: true, data: alerts.map(toAnomaly) });
    if (method === "GET" && path === "/alerts/summary") {
      return send(res, 200, {
        success: true,
        data: {
          ...summarizeAlerts(alerts),
          total_records_analyzed: records.length,
          totalRecordsAnalyzed: records.length
        }
      });
    }
    if (method === "GET" && path === "/alerts/pattern-whispers") return send(res, 200, { success: true, data: buildWhispers(alerts) });
    if (method === "GET" && path === "/alerts/charts") return send(res, 200, { success: true, data: buildCharts(alerts, records) });
    if (method === "GET" && path === "/alerts/filters") return send(res, 200, { success: true, data: buildFilterOptions(allRecords, detectAlerts(allRecords)) });

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[alert-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Alert API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
