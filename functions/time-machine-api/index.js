const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  hasCoordinates,
  isHeinous,
  isNonHeinous,
  topN,
  toNumber
} = require("./crimeAnalytics");

const SERVICE_NAME = "time-machine-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /time-machine/summary",
  "GET /time-machine/timeline",
  "GET /time-machine/yearly",
  "GET /time-machine/monthly",
  "GET /time-machine/compare",
  "GET /time-machine/movement",
  "GET /time-machine/insights",
  "GET /time-machine/filters"
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

function pctChange(previous, current) {
  if (!previous && current) return 100;
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function periodOf(record) {
  const year = clean(record.fir_year) || "Unknown";
  const month = clean(record.fir_month) || "Unknown";
  if (year === "Unknown" || month === "Unknown") return "Unknown";
  return `${year}-${String(month).padStart(2, "0")}`;
}

function groupBy(records, keyFn) {
  return records.reduce((acc, record) => {
    const key = keyFn(record);
    acc[key] = acc[key] || [];
    acc[key].push(record);
    return acc;
  }, {});
}

function totals(records) {
  return {
    victim_count: records.reduce((sum, record) => sum + toNumber(record.victim_count), 0),
    accused_count: records.reduce((sum, record) => sum + toNumber(record.accused_count), 0),
    arrest_count: records.reduce((sum, record) => sum + toNumber(record.arrested_count), 0),
    conviction_count: records.reduce((sum, record) => sum + toNumber(record.conviction_count), 0)
  };
}

function timeline(records) {
  return Object.entries(groupBy(records, periodOf))
    .filter(([period]) => period !== "Unknown")
    .map(([period, scoped]) => {
      const [year, month] = period.split("-");
      const counts = totals(scoped);
      return {
        period,
        year,
        month: String(Number(month)),
        total_crimes: scoped.length,
        heinous_count: scoped.filter(isHeinous).length,
        non_heinous_count: scoped.filter(isNonHeinous).length,
        top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
        top_district: topN(scoped, "district", 1)[0]?.name || "No data",
        victim_count: counts.victim_count,
        accused_count: counts.accused_count,
        arrest_count: counts.arrest_count,
        conviction_count: counts.conviction_count,
        risk_level: riskLevel(Math.min(100, scoped.length))
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

function yearly(records) {
  const groups = groupBy(records, (record) => clean(record.fir_year) || "Unknown");
  return Object.entries(groups)
    .filter(([year]) => year !== "Unknown")
    .map(([year, scoped]) => {
      const counts = totals(scoped);
      return {
        year,
        total_crimes: scoped.length,
        heinous_count: scoped.filter(isHeinous).length,
        non_heinous_count: scoped.filter(isNonHeinous).length,
        top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
        top_district: topN(scoped, "district", 1)[0]?.name || "No data",
        victim_count: counts.victim_count,
        accused_count: counts.accused_count,
        arrest_count: counts.arrest_count,
        conviction_count: counts.conviction_count
      };
    })
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function monthly(records) {
  const groups = groupBy(records, (record) => clean(record.fir_month) || "Unknown");
  const years = new Set(records.map((record) => clean(record.fir_year)).filter(Boolean)).size || 1;
  const rows = Object.entries(groups)
    .filter(([month]) => month !== "Unknown")
    .map(([month, scoped]) => ({
      month: String(Number(month)),
      total_crimes: scoped.length,
      average_per_year: Math.round(scoped.length / years),
      top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
      seasonal_risk_level: "Low"
    }))
    .sort((a, b) => Number(a.month) - Number(b.month));
  const averageMonthCount = rows.length ? rows.reduce((sum, row) => sum + row.total_crimes, 0) / rows.length : 0;
  return rows.map((row) => ({
    ...row,
    seasonal_risk_level: riskLevel(Math.round((row.total_crimes / Math.max(averageMonthCount, 1)) * 40))
  }));
}

function summary(records) {
  const line = timeline(records);
  const years = [...new Set(records.map((record) => clean(record.fir_year)).filter(Boolean))].map(Number).filter(Number.isFinite);
  const months = [...new Set(records.map((record) => clean(record.fir_month)).filter(Boolean))].map(Number).filter(Number.isFinite);
  const peak = line.reduce((best, item) => item.total_crimes > (best?.total_crimes || 0) ? item : best, null);
  const latest = line.at(-1);
  const previous = line.at(-2);
  const crimeGrowth = movementItems(records, "crime_type").rising[0];
  return {
    total_records: records.length,
    year_range: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "No data",
    month_range: months.length ? `${Math.min(...months)}-${Math.max(...months)}` : "No data",
    earliest_record: line[0]?.period || "No data",
    latest_record: latest?.period || "No data",
    peak_year: peak?.year || "No data",
    peak_month: peak?.month || "No data",
    fastest_growing_crime_type: crimeGrowth?.name || "No data",
    trend_direction: latest && previous ? (latest.total_crimes > previous.total_crimes ? "Rising" : latest.total_crimes < previous.total_crimes ? "Falling" : "Stable") : "Stable",
    total_periods_available: line.length
  };
}

function pickPeriodRecords(records, year, month) {
  return records.filter((record) => clean(record.fir_year) === clean(year) && clean(record.fir_month) === String(Number(month)));
}

function changeList(fromRecords, toRecords, field) {
  const names = [...new Set([...fromRecords.map((record) => clean(record[field])), ...toRecords.map((record) => clean(record[field]))].filter(Boolean))];
  return names.map((name) => {
    const previous = fromRecords.filter((record) => clean(record[field]) === name).length;
    const value = toRecords.filter((record) => clean(record[field]) === name).length;
    return { name, value, previous, change: pctChange(previous, value) };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.value - a.value);
}

function compare(records, params = {}) {
  const line = timeline(records);
  const first = line[0];
  const last = line.at(-1);
  const fromYear = params.from_year || first?.year;
  const fromMonth = params.from_month || first?.month;
  const toYear = params.to_year || last?.year;
  const toMonth = params.to_month || last?.month;
  const fromRecords = pickPeriodRecords(records, fromYear, fromMonth);
  const toRecords = pickPeriodRecords(records, toYear, toMonth);
  const fromTotal = fromRecords.length;
  const toTotal = toRecords.length;
  const change = pctChange(fromTotal, toTotal);
  const crimeChanges = changeList(fromRecords, toRecords, "crime_type");
  const districtChanges = changeList(fromRecords, toRecords, "district");
  return {
    from_period: fromYear && fromMonth ? `${fromYear}-${String(fromMonth).padStart(2, "0")}` : "No data",
    to_period: toYear && toMonth ? `${toYear}-${String(toMonth).padStart(2, "0")}` : "No data",
    from_total: fromTotal,
    to_total: toTotal,
    difference: toTotal - fromTotal,
    percentage_change: change,
    trend: change > 5 ? "Rising" : change < -5 ? "Falling" : "Stable",
    changed_crime_types: crimeChanges.slice(0, 10),
    changed_districts: districtChanges.slice(0, 10),
    insight: `Crime volume changed from ${fromTotal} to ${toTotal}, a ${change}% movement.`,
    selected_period: toYear && toMonth ? `${toYear}-${String(toMonth).padStart(2, "0")}` : "No data",
    previous_period: fromYear && fromMonth ? `${fromYear}-${String(fromMonth).padStart(2, "0")}` : "No data",
    selected_total: toTotal,
    previous_total: fromTotal,
    top_increasing_districts: districtChanges.filter((item) => item.change >= 0).slice(0, 10),
    top_decreasing_districts: districtChanges.filter((item) => item.change < 0).slice(0, 10),
    top_increasing_crime_types: crimeChanges.filter((item) => item.change >= 0).slice(0, 10),
    top_decreasing_crime_types: crimeChanges.filter((item) => item.change < 0).slice(0, 10),
    severity_change: changeList(fromRecords, toRecords, "severity").slice(0, 10)
  };
}

function splitHalves(records) {
  const line = timeline(records);
  if (line.length < 2) return { firstRecords: [], secondRecords: records };
  const midpoint = Math.floor(line.length / 2);
  const firstPeriods = new Set(line.slice(0, midpoint).map((item) => item.period));
  const secondPeriods = new Set(line.slice(midpoint).map((item) => item.period));
  return {
    firstRecords: records.filter((record) => firstPeriods.has(periodOf(record))),
    secondRecords: records.filter((record) => secondPeriods.has(periodOf(record)))
  };
}

function movementItems(records, field) {
  const { firstRecords, secondRecords } = splitHalves(records);
  const changes = changeList(firstRecords, secondRecords, field);
  return {
    rising: changes.filter((item) => item.change > 0).slice(0, 10),
    declining: changes.filter((item) => item.change < 0).slice(0, 10),
    all: changes.slice(0, 20)
  };
}

function movement(records) {
  const district = movementItems(records, "district");
  const crime = movementItems(records, "crime_type");
  const station = movementItems(records, "police_station");
  const movementPatterns = district.rising.slice(0, 8).map((item) => ({
    pattern_type: "District crime movement",
    from_area: "First half",
    to_area: item.name,
    crime_type: topN(records.filter((record) => record.district === item.name), "crime_type", 1)[0]?.name || "Unknown",
    change_percentage: item.change,
    explanation: `${item.name} increased from ${item.previous} to ${item.value} records across the timeline split.`
  }));
  return {
    district_movement: district.all,
    crime_type_movement: crime.all,
    police_station_movement: station.all,
    rising_districts: district.rising,
    declining_districts: district.declining,
    rising_crime_types: crime.rising,
    declining_crime_types: crime.declining,
    movement_patterns: movementPatterns
  };
}

function insights(records) {
  const line = timeline(records);
  const sum = summary(records);
  const comp = compare(records);
  const topDistrict = topN(records, "district", 1)[0]?.name || "No data";
  const topCrime = topN(records, "crime_type", 1)[0]?.name || "No data";
  const coordinatePct = records.length ? Math.round((records.filter(hasCoordinates).length / records.length) * 100) : 0;
  const result = [
    {
      insight_type: "Peak Activity",
      title: `Crime activity peaked in ${sum.peak_month}/${sum.peak_year}.`,
      description: `The highest period in the selected data is ${line.reduce((best, item) => item.total_crimes > (best?.total_crimes || 0) ? item : best, null)?.period || "No data"}.`,
      evidence: [`Peak year: ${sum.peak_year}`, `Peak month: ${sum.peak_month}`],
      recommendation: "Review deployment and case load around peak periods.",
      severity: "Medium",
      related_district: topDistrict,
      related_crime_type: topCrime,
      suggested_action: "Review deployment and case load around peak periods."
    },
    {
      insight_type: "Trend Direction",
      title: `${topCrime} is the dominant temporal crime type.`,
      description: `Overall trend direction is ${comp.trend} with ${comp.percentage_change}% change between compared periods.`,
      evidence: [`From total: ${comp.from_total}`, `To total: ${comp.to_total}`, `Change: ${comp.percentage_change}%`],
      recommendation: "Use the trend direction to tune preventive patrol and investigation focus.",
      severity: comp.trend === "Rising" ? "High" : "Low",
      related_district: topDistrict,
      related_crime_type: topCrime,
      suggested_action: "Use the trend direction to tune preventive patrol and investigation focus."
    }
  ];
  if (coordinatePct < 40) {
    result.push({
      insight_type: "Data Quality",
      title: "Coordinate availability is low, so spatial time movement is limited.",
      description: `Only ${coordinatePct}% of records contain exact coordinates.`,
      evidence: [`Coordinate availability: ${coordinatePct}%`],
      recommendation: "Improve FIR geotagging for stronger time-location movement analysis.",
      severity: "Medium",
      related_district: topDistrict,
      related_crime_type: topCrime,
      suggested_action: "Improve FIR geotagging for stronger time-location movement analysis."
    });
  }
  return result;
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[time-machine-api] method:", method);
  console.log("[time-machine-api] raw url:", req.url);
  console.log("[time-machine-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI time-machine-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const params = query(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);

    if (method === "GET" && path === "/time-machine/summary") return send(res, 200, { success: true, data: summary(records) });
    if (method === "GET" && path === "/time-machine/timeline") return send(res, 200, { success: true, data: { timeline: timeline(records) } });
    if (method === "GET" && path === "/time-machine/yearly") return send(res, 200, { success: true, data: yearly(records) });
    if (method === "GET" && path === "/time-machine/monthly") return send(res, 200, { success: true, data: monthly(records) });
    if (method === "GET" && path === "/time-machine/compare") return send(res, 200, { success: true, data: compare(records, params) });
    if (method === "GET" && path === "/time-machine/movement") return send(res, 200, { success: true, data: movement(records) });
    if (method === "GET" && path === "/time-machine/insights") return send(res, 200, { success: true, data: { insights: insights(records) } });
    if (method === "GET" && path === "/time-machine/filters") {
      return send(res, 200, {
        success: true,
        data: {
          ...filterOptions(allRecords),
          presets: [
            { value: "year-wise", label: "Year-wise view", configurable: false, notice: "" },
            { value: "latest-vs-earliest", label: "Earliest vs latest", configurable: false, notice: "" }
          ]
        }
      });
    }

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[time-machine-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Time Machine API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
