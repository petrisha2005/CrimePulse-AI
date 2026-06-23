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
const CRIME_TABLE = process.env.CRIME_TABLE || process.env.CRIME_RECORDS_TABLE || "CrimeRecords";
const PAGE_SIZE = 200;
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
  "GET /time-machine/period",
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

function unwrapRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function recordValue(row, key) {
  return row?.[key] ?? row?.[CRIME_TABLE]?.[key] ?? row?.CrimeRecords?.[key] ?? "";
}

function normalizeCrimeRow(row) {
  return {
    ROWID: recordValue(row, "ROWID"),
    crime_id: clean(recordValue(row, "crime_id")),
    district: clean(recordValue(row, "district")),
    police_station: clean(recordValue(row, "police_station")),
    crime_type: clean(recordValue(row, "crime_type")),
    crime_subtype: clean(recordValue(row, "crime_subtype")),
    severity: clean(recordValue(row, "severity")) || "Low",
    severity_original: clean(recordValue(row, "severity_original")),
    fir_year: clean(recordValue(row, "fir_year")),
    fir_month: clean(recordValue(row, "fir_month")),
    fir_day: clean(recordValue(row, "fir_day")),
    crime_date: clean(recordValue(row, "crime_date")),
    latitude_value: clean(recordValue(row, "latitude_value")),
    longitude_value: clean(recordValue(row, "longitude_value")),
    fir_stage: clean(recordValue(row, "fir_stage")),
    complaint_mode: clean(recordValue(row, "complaint_mode")),
    victim_count: toNumber(recordValue(row, "victim_count")),
    accused_count: toNumber(recordValue(row, "accused_count")),
    arrested_count: toNumber(recordValue(row, "arrested_count")),
    conviction_count: toNumber(recordValue(row, "conviction_count"))
  };
}

async function fetchAllCrimeRecords(app) {
  const allRows = [];
  let offset = 0;
  try {
    while (true) {
      const result = await app.zcql().executeZCQLQuery(`SELECT * FROM ${CRIME_TABLE} LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
      const rows = unwrapRows(result);
      allRows.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return allRows.map(normalizeCrimeRow);
  } catch (error) {
    console.warn("[time-machine-api] paginated ZCQL failed; using Data Store fallback", error.message);
    try {
      const rows = unwrapRows(await app.datastore().table(CRIME_TABLE).getAllRows());
      return rows.map(normalizeCrimeRow);
    } catch (fallbackError) {
      console.warn("[time-machine-api] Data Store fallback failed; using shared loader", fallbackError.message);
      return fetchCrimeRecords(app, { limit: 5000 });
    }
  }
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
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const groups = groupBy(records, (record) => clean(record.fir_month) || "Unknown");
  const years = new Set(records.map((record) => clean(record.fir_year)).filter(Boolean)).size || 1;
  const rows = Object.entries(groups)
    .filter(([month]) => month !== "Unknown")
    .map(([month, scoped]) => ({
      month: String(Number(month)),
      month_name: monthNames[Number(month) - 1] || "Unknown",
      total_crimes: scoped.length,
      average_per_year: Math.round(scoped.length / years),
      top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
      seasonal_risk_level: "Low"
    }))
    .sort((a, b) => Number(a.month) - Number(b.month));
  const averageMonthCount = rows.length ? rows.reduce((sum, row) => sum + row.total_crimes, 0) / rows.length : 0;
  return rows.map((row) => ({
    ...row,
    seasonal_risk_level: riskLevel(Math.round((row.total_crimes / Math.max(averageMonthCount, 1)) * 40)),
    risk_level: riskLevel(Math.round((row.total_crimes / Math.max(averageMonthCount, 1)) * 40))
  }));
}

function summary(records) {
  const line = timeline(records);
  const years = [...new Set(records.map((record) => clean(record.fir_year)).filter(Boolean))].map(Number).filter(Number.isFinite);
  const months = [...new Set(records.map((record) => clean(record.fir_month)).filter(Boolean))].map(Number).filter(Number.isFinite);
  const peak = line.reduce((best, item) => item.total_crimes > (best?.total_crimes || 0) ? item : best, null);
  const latest = line.at(-1);
  const previous = line.at(-2);
  const crimeMovement = movementItems(records, "crime_type");
  const crimeGrowth = crimeMovement.rising[0];
  const crimeFalling = crimeMovement.declining[0];
  const percentageChange = latest && previous ? pctChange(previous.total_crimes, latest.total_crimes) : 0;
  return {
    total_records: records.length,
    year_range: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "No data",
    month_range: months.length ? `${Math.min(...months)}-${Math.max(...months)}` : "No data",
    earliest_record: line[0]?.period || "No data",
    latest_record: latest?.period || "No data",
    earliest_period: line[0]?.period || "No data",
    latest_period: latest?.period || "No data",
    peak_period: peak?.period || "No data",
    peak_period_crimes: peak?.total_crimes || 0,
    peak_year: peak?.year || "No data",
    peak_month: peak?.month || "No data",
    fastest_growing_crime_type: crimeGrowth?.name || "No data",
    fastest_rising_crime_type: crimeGrowth?.name || "No data",
    fastest_falling_crime_type: crimeFalling?.name || "No data",
    most_active_district: topN(records, "district", 1)[0]?.name || "No data",
    trend_direction: percentageChange > 5 ? "Increasing" : percentageChange < -5 ? "Decreasing" : "Stable",
    percentage_change: percentageChange,
    total_periods_available: line.length,
    time_machine_summary: "Crime Time Machine compares FIR records across years and months to reveal when crime increased, reduced, peaked, and which categories changed most."
  };
}

function pickPeriodRecords(records, year, month) {
  return records.filter((record) => clean(record.fir_year) === clean(year) && Number(record.fir_month) === Number(month));
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
    trend: change > 5 ? "Increased" : change < -5 ? "Reduced" : "Stable",
    changed_crime_types: crimeChanges.slice(0, 10),
    changed_districts: districtChanges.slice(0, 10),
    insight: `Crime volume changed from ${fromTotal} to ${toTotal}, a ${change}% movement.`,
    explanation: `Crime ${change > 5 ? "increased" : change < -5 ? "reduced" : "remained stable"} by ${Math.abs(change)}% from ${fromYear}-${String(fromMonth).padStart(2, "0")} to ${toYear}-${String(toMonth).padStart(2, "0")}, mainly influenced by ${crimeChanges[0]?.name || "available crime categories"}.`,
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
    falling_districts: district.declining,
    rising_crime_types: crime.rising,
    declining_crime_types: crime.declining,
    falling_crime_types: crime.declining,
    rising_police_stations: station.rising,
    falling_police_stations: station.declining,
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

function periodDetails(records, period) {
  const line = timeline(records);
  const isYearPeriod = /^\d{4}$/.test(clean(period));
  const yearLine = yearly(records).map((item) => ({ ...item, period: item.year, month: "" }));
  const source = isYearPeriod ? yearLine : line;
  const index = source.findIndex((item) => item.period === period);
  const active = index >= 0 ? source[index] : source[0];
  const previous = index > 0 ? source[index - 1] : null;
  const recordsFor = (item) => !item ? [] : isYearPeriod
    ? records.filter((record) => clean(record.fir_year) === clean(item.year))
    : pickPeriodRecords(records, item.year, item.month);
  const scoped = recordsFor(active);
  const previousRecords = recordsFor(previous);
  const currentTotal = scoped.length;
  const previousTotal = previousRecords.length;
  const percentageChange = previous ? pctChange(previousTotal, currentTotal) : 0;
  const topCrimeTypes = topN(scoped, "crime_type", 8);
  const districts = topN(scoped, "district", 8);
  const stations = topN(scoped, "police_station", 8);
  const heinous = scoped.filter(isHeinous).length;
  const nonHeinous = scoped.filter(isNonHeinous).length;
  const other = Math.max(currentTotal - heinous - nonHeinous, 0);
  const crimeChanges = changeList(previousRecords, scoped, "crime_type");
  const topChange = crimeChanges.find((item) => item.change > 0);
  const trend = percentageChange > 5 ? "Increasing" : percentageChange < -5 ? "Decreasing" : "Stable";
  return {
    period: active?.period || "No data",
    previous_period: previous?.period || "No previous period",
    total_crimes: currentTotal,
    previous_total: previousTotal,
    percentage_change: percentageChange,
    trend_direction: trend,
    top_crime_type: topCrimeTypes[0]?.name || "No data",
    top_district: districts[0]?.name || "No data",
    heinous_count: heinous,
    top_crime_types: topCrimeTypes,
    districts,
    police_stations: stations,
    severity_distribution: [
      { name: "Heinous", value: heinous },
      { name: "Non-Heinous", value: nonHeinous },
      { name: "Other", value: other }
    ],
    coordinate_mode: scoped.length && scoped.every((record) => !hasCoordinates(record)) ? "District-level fallback" : "Exact / mixed coordinates",
    insight: `Crime ${trend === "Increasing" ? "increased" : trend === "Decreasing" ? "decreased" : "remained stable"} by ${Math.abs(percentageChange)}% compared with ${previous?.period || "the prior available period"}. ${districts[0]?.name || "No district"} remained the most active district. ${topChange ? `${topChange.name} changed by ${topChange.change}% in this period.` : "Crime type movement is limited by the available period comparison."}`
  };
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
    const allRecords = await fetchAllCrimeRecords(app);
    const records = applyFilters(allRecords, params);

    if (method === "GET" && path === "/time-machine/summary") return send(res, 200, { success: true, data: summary(records) });
    if (method === "GET" && path === "/time-machine/timeline") return send(res, 200, { success: true, data: timeline(records) });
    if (method === "GET" && path === "/time-machine/yearly") return send(res, 200, { success: true, data: yearly(records) });
    if (method === "GET" && path === "/time-machine/monthly") return send(res, 200, { success: true, data: monthly(records) });
    if (method === "GET" && path === "/time-machine/compare") return send(res, 200, { success: true, data: compare(records, params) });
    if (method === "GET" && path === "/time-machine/movement") return send(res, 200, { success: true, data: movement(records) });
    if (method === "GET" && path === "/time-machine/insights") return send(res, 200, { success: true, data: insights(records) });
    if (method === "GET" && path === "/time-machine/period") return send(res, 200, { success: true, data: periodDetails(records, params.period) });
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
