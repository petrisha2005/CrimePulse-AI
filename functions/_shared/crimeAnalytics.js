const CRIME_TABLE = process.env.CRIME_TABLE || process.env.CRIME_RECORDS_TABLE || "CrimeRecords";
const ANALYTICS_CACHE_TABLE = process.env.ANALYTICS_CACHE_TABLE || "AnalyticsCache";
const ANALYTICS_CACHE_KEY = process.env.ANALYTICS_CACHE_KEY || "crime_records_full_dataset";
const PAGE_SIZE = Math.max(50, Math.min(Number(process.env.CRIME_ANALYTICS_PAGE_SIZE || 200), 300));
const memoryCache = new Map();

const clean = (value) => String(value ?? "").trim();
const hasValue = (value) => clean(value) !== "";
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function unwrapRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

function value(row, key) {
  return row?.[key] ?? row?.[CRIME_TABLE]?.[key] ?? row?.CrimeRecords?.[key] ?? "";
}

function normalizeRecord(row) {
  return {
    ROWID: value(row, "ROWID"),
    MODIFIEDTIME: value(row, "MODIFIEDTIME"),
    crime_id: clean(value(row, "crime_id")),
    district: clean(value(row, "district")),
    police_station: clean(value(row, "police_station")),
    crime_type: clean(value(row, "crime_type")),
    crime_subtype: clean(value(row, "crime_subtype")),
    severity: clean(value(row, "severity")) || "Low",
    severity_original: clean(value(row, "severity_original")),
    fir_year: clean(value(row, "fir_year")),
    fir_month: clean(value(row, "fir_month")),
    fir_day: clean(value(row, "fir_day")),
    crime_date: clean(value(row, "crime_date")),
    latitude_value: clean(value(row, "latitude_value")),
    longitude_value: clean(value(row, "longitude_value")),
    offence_location: clean(value(row, "offence_location")),
    beat_name: clean(value(row, "beat_name")),
    village_area_name: clean(value(row, "village_area_name")),
    fir_stage: clean(value(row, "fir_stage")),
    complaint_mode: clean(value(row, "complaint_mode")),
    act_section: clean(value(row, "act_section")),
    victim_count: toNumber(value(row, "victim_count")),
    accused_count: toNumber(value(row, "accused_count")),
    arrested_count: toNumber(value(row, "arrested_count")),
    conviction_count: toNumber(value(row, "conviction_count")),
    unit_id: clean(value(row, "unit_id")),
    created_time: clean(value(row, "created_time")),
    dataset_id: clean(value(row, "dataset_id")),
    dataset_name: clean(value(row, "dataset_name")),
    upload_id: clean(value(row, "upload_id")),
    source_file_name: clean(value(row, "source_file_name")),
    imported_at: clean(value(row, "imported_at"))
  };
}

function unwrapPagedRows(result) {
  const rows = unwrapRows(result);
  const nextToken = result?.next_token || result?.nextToken || result?.data?.next_token || result?.data?.nextToken || "";
  const moreRecords = Boolean(result?.more_records || result?.moreRecords || result?.data?.more_records || result?.data?.moreRecords || nextToken);
  return { rows, nextToken, moreRecords };
}

async function fetchAllCrimeRecords(app, options = {}) {
  const pageSize = Math.max(50, Math.min(Number(options.pageSize || PAGE_SIZE), 300));
  const rows = [];
  let nextToken;

  try {
    const table = app.datastore().table(CRIME_TABLE);
    while (true) {
      const page = await table.getPagedRows({ nextToken, maxRows: pageSize });
      const { rows: pageRows, nextToken: next, moreRecords } = unwrapPagedRows(page);
      rows.push(...pageRows);
      if (!moreRecords || !next || pageRows.length === 0) break;
      nextToken = next;
    }
  } catch (pagedError) {
    console.warn("[crimeAnalytics] Data Store paged fetch failed, falling back to ZCQL pagination", pagedError.message);
    let offset = 0;
    while (true) {
      const pageRows = unwrapRows(await app.zcql().executeZCQLQuery(`SELECT * FROM ${CRIME_TABLE} LIMIT ${pageSize} OFFSET ${offset}`));
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
      offset += pageSize;
    }
  }

  const normalized = rows.map(normalizeRecord);
  const filtered = options.filters ? applyFilters(normalized, options.filters) : normalized;
  if (options.includeMeta) {
    return {
      records: filtered,
      totalFetched: filtered.length,
      totalAvailable: normalized.length,
      meta: {
        totalUploadedRecords: normalized.length,
        recordsAnalyzed: filtered.length,
        analysisScope: options.filters && Object.values(normalizeFilters(options.filters)).some(isActiveFilter) ? "filtered_dataset" : "full_dataset",
        isSampled: false
      }
    };
  }
  return filtered;
}

async function fetchCrimeRecords(app, options = {}) {
  return fetchAllCrimeRecords(app, options);
}

async function forEachCrimeRecordPage(app, filters = {}, pageSize = PAGE_SIZE, callback) {
  const size = Math.max(50, Math.min(Number(pageSize) || 200, 300));
  let nextToken;
  let processed = 0;
  const table = app.datastore().table(CRIME_TABLE);
  while (true) {
    const result = await table.getPagedRows({ nextToken, maxRows: size });
    const { rows, nextToken: next, moreRecords } = unwrapPagedRows(result);
    const page = rows.map(normalizeRecord);
    const filtered = applyFilters(page, filters);
    if (filtered.length) await callback(filtered, { nextToken, processed });
    processed += page.length;
    if (!moreRecords || !next || page.length === 0) break;
    nextToken = next;
  }
  return processed;
}

function normalizeFilters(params = {}) {
  const pick = (key, fallback = "") => clean(params[key] ?? params[fallback]);
  return {
    fir_year: pick("fir_year", "year"),
    fir_month: pick("fir_month", "month"),
    district: pick("district"),
    police_station: pick("police_station"),
    crime_type: pick("crime_type"),
    crime_subtype: pick("crime_subtype"),
    severity: pick("severity"),
    fir_stage: pick("fir_stage", "status"),
    complaint_mode: pick("complaint_mode"),
    dataset_id: pick("dataset_id")
  };
}

function isActiveFilter(value) {
  const normalized = clean(value).toLowerCase();
  return normalized !== "" && normalized !== "all";
}

function applyFilters(records, params = {}) {
  const filters = normalizeFilters(params);
  return records.filter((record) => {
    if (isActiveFilter(filters.fir_year) && record.fir_year !== filters.fir_year) return false;
    if (isActiveFilter(filters.fir_month) && record.fir_month !== filters.fir_month) return false;
    if (isActiveFilter(filters.district) && record.district !== filters.district) return false;
    if (isActiveFilter(filters.police_station) && record.police_station !== filters.police_station) return false;
    if (isActiveFilter(filters.crime_type) && record.crime_type !== filters.crime_type) return false;
    if (isActiveFilter(filters.crime_subtype) && record.crime_subtype !== filters.crime_subtype) return false;
    if (isActiveFilter(filters.severity) && record.severity !== filters.severity && record.severity_original !== filters.severity) return false;
    if (isActiveFilter(filters.fir_stage) && record.fir_stage !== filters.fir_stage) return false;
    if (isActiveFilter(filters.complaint_mode) && record.complaint_mode !== filters.complaint_mode) return false;
    if (isActiveFilter(filters.dataset_id) && record.dataset_id !== filters.dataset_id) return false;
    return true;
  });
}

function groupCount(records, field) {
  return records.reduce((acc, record) => {
    const key = clean(record[field]) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topN(records, field, n = 10) {
  return Object.entries(groupCount(records, field))
    .map(([name, value]) => ({ name, value, count: value, [field]: name }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function unique(records, field) {
  return [...new Set(records.map((record) => clean(record[field])).filter(Boolean))].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });
}

const isHeinous = (record) => {
  const original = record.severity_original.toLowerCase();
  const severity = record.severity.toLowerCase();
  return (original.includes("heinous") && !original.includes("non")) || severity === "high" || severity === "critical";
};

const isNonHeinous = (record) => {
  const original = record.severity_original.toLowerCase();
  const severity = record.severity.toLowerCase();
  return original.includes("non heinous") || original.includes("non-heinous") || severity === "medium";
};

const hasCoordinates = (record) => hasValue(record.latitude_value) && hasValue(record.longitude_value);
const requiredComplete = (record) =>
  hasValue(record.district) &&
  hasValue(record.police_station) &&
  hasValue(record.crime_type) &&
  hasValue(record.fir_year) &&
  hasValue(record.fir_month) &&
  hasValue(record.fir_day);

function getGlobalStats(records) {
  const years = unique(records, "fir_year").map(Number).filter((year) => Number.isFinite(year) && year > 0);
  const withCoordinates = records.filter(hasCoordinates).length;
  const completeRequired = records.filter(requiredComplete).length;
  const coordinatePercentage = pct(withCoordinates, records.length);
  return {
    total_records: records.length,
    total_uploaded_records: records.length,
    records_analyzed: records.length,
    analysis_scope: "full_dataset",
    is_sampled: false,
    total_districts: unique(records, "district").length,
    total_police_stations: unique(records, "police_station").length,
    year_range: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "No data",
    total_crime_groups: unique(records, "crime_type").length,
    records_with_coordinates: withCoordinates,
    records_without_coordinates: Math.max(records.length - withCoordinates, 0),
    coordinate_available_percentage: coordinatePercentage,
    data_quality_score: records.length ? Math.round(pct(completeRequired, records.length) * 0.8 + coordinatePercentage * 0.2) : 0,
    last_updated: records.map((record) => record.created_time || record.MODIFIEDTIME).filter(Boolean).sort().at(-1) || new Date().toISOString()
  };
}

function getDashboardSummary(records) {
  const topCrime = topN(records, "crime_type", 1)[0];
  const withCoordinates = records.filter(hasCoordinates).length;
  const totalVictims = records.reduce((sum, record) => sum + record.victim_count, 0);
  const totalAccused = records.reduce((sum, record) => sum + record.accused_count, 0);
  const totalArrests = records.reduce((sum, record) => sum + record.arrested_count, 0);
  const totalConvictions = records.reduce((sum, record) => sum + record.conviction_count, 0);
  const heinous = records.filter(isHeinous).length;
  const nonHeinous = records.filter(isNonHeinous).length;
  return {
    total_crimes: records.length,
    total_districts: unique(records, "district").length,
    total_police_stations: unique(records, "police_station").length,
    most_reported_crime_type: topCrime?.name || "No data",
    heinous_count: heinous,
    non_heinous_count: nonHeinous,
    total_victims: totalVictims,
    total_accused: totalAccused,
    total_arrests: totalArrests,
    total_convictions: totalConvictions,
    coordinate_available_percentage: pct(withCoordinates, records.length),
    totalCrimes: records.length,
    totalDistricts: unique(records, "district").length,
    totalPoliceStations: unique(records, "police_station").length,
    mostReportedCrimeType: topCrime?.name || "No data",
    heinousCrimeCount: heinous,
    nonHeinousCrimeCount: nonHeinous,
    highSeverityCrimes: records.filter((record) => ["High", "Critical"].includes(record.severity)).length,
    totalVictims,
    totalAccused,
    totalArrests,
    totalConvictions,
    coordinateAvailablePercentage: pct(withCoordinates, records.length)
  };
}

function getMonthlyTrend(records) {
  const counts = records.reduce((acc, record) => {
    const year = record.fir_year || "Unknown";
    const month = record.fir_month || "Unknown";
    const period = year !== "Unknown" && month !== "Unknown" ? `${year}-${String(month).padStart(2, "0")}` : "Unknown";
    acc[period] = acc[period] || { period, year, month, count: 0, crimes: 0 };
    acc[period].count += 1;
    acc[period].crimes += 1;
    return acc;
  }, {});
  return Object.values(counts).sort((a, b) => a.period.localeCompare(b.period));
}

function getYearlyTrend(records) {
  return topN(records, "fir_year", 200)
    .map((item) => ({ year: item.name, count: item.value, crimes: item.value }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function rate(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function calculateRiskScore(records, district) {
  const districtRecords = records.filter((record) => record.district === district);
  const districts = unique(records, "district").length || 1;
  const average = records.length / districts;
  const volumeScore = Math.min((districtRecords.length / Math.max(average, 1)) * 25, 25);
  const heinousScore = rate(districtRecords.filter(isHeinous).length, districtRecords.length) * 0.2;
  const monthly = getMonthlyTrend(districtRecords);
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.slice(-4, -1);
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest;
  const trendScore = Math.min((latest / Math.max(previousAverage, 1)) * 10, 20);
  const topStationShare = districtRecords.length ? (topN(districtRecords, "police_station", 1)[0]?.value || 0) / districtRecords.length : 0;
  const concentrationScore = Math.min(topStationShare * 30, 15);
  const arrestRate = rate(districtRecords.reduce((s, r) => s + r.arrested_count, 0), districtRecords.reduce((s, r) => s + r.accused_count, 0));
  const convictionRate = rate(districtRecords.reduce((s, r) => s + r.conviction_count, 0), districtRecords.reduce((s, r) => s + r.accused_count, 0));
  const gapScore = Math.max(0, 10 - ((arrestRate + convictionRate) / 20));
  const completeness = rate(districtRecords.filter(requiredComplete).length, districtRecords.length);
  const confidenceScore = Math.round(completeness * 0.8 + rate(districtRecords.filter(hasCoordinates).length, districtRecords.length) * 0.2);
  const risk_score = Math.round(Math.min(volumeScore + heinousScore + trendScore + concentrationScore + gapScore + 10, 100));
  return { risk_score, risk_level: riskLevel(risk_score), confidence_score: confidenceScore, trend_direction: latest > previousAverage * 1.1 ? "Increasing" : latest < previousAverage * 0.9 ? "Decreasing" : "Stable", arrest_rate: arrestRate, conviction_rate: convictionRate };
}

function recommendedAction(crimeType = "") {
  const lower = crimeType.toLowerCase();
  if (lower.includes("theft") || lower.includes("vehicle")) return "Increase patrol near transport hubs, parking areas, and commercial zones.";
  if (lower.includes("cyber") || lower.includes("financial") || lower.includes("fraud")) return "Launch cyber awareness and strengthen digital complaint follow-up.";
  if (lower.includes("burglary")) return "Increase night surveillance in residential areas.";
  if (lower.includes("assault") || lower.includes("violent")) return "Deploy focused patrol in repeat locations.";
  return "Review deployment, case follow-up, and prevention activities for this area.";
}

function detectAnomalies(records) {
  const alerts = [];
  topN(records, "district", 50).forEach((districtItem, index) => {
    const districtRecords = records.filter((record) => record.district === districtItem.name);
    const monthly = getMonthlyTrend(districtRecords);
    const latest = monthly.at(-1);
    const previous = monthly.slice(-4, -1);
    const expected = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest?.count || 0;
    const increase = expected > 0 ? Math.round((((latest?.count || 0) - expected) / expected) * 100) : 0;
    const topCrime = topN(districtRecords, "crime_type", 1)[0];
    if (latest && increase >= 50) {
      alerts.push({
        alert_id: `spike-${index}`,
        alert_type: "Sudden Crime Spike",
        title: `${topCrime?.name || "Crime"} spike in ${districtItem.name}`,
        district: districtItem.name,
        police_station: topN(districtRecords, "police_station", 1)[0]?.name || "",
        crime_type: topCrime?.name || "Unknown",
        severity: increase >= 200 ? "Critical" : increase >= 100 ? "High" : "Medium",
        increase_percentage: increase,
        current_value: latest.count,
        expected_value: Math.round(expected),
        time_period: latest.period,
        explanation: `Current count is above the previous 3-period average.`,
        recommended_action: recommendedAction(topCrime?.name),
        detected_at: new Date().toISOString()
      });
    }
    const missing = districtRecords.filter((record) => !hasCoordinates(record)).length;
    if (rate(missing, districtRecords.length) > 50) {
      alerts.push({
        alert_id: `data-${index}`,
        alert_type: "Location Missing Data Alert",
        title: `Geotagging quality issue in ${districtItem.name}`,
        district: districtItem.name,
        police_station: "",
        crime_type: "Data Quality",
        severity: "Low",
        increase_percentage: 0,
        current_value: missing,
        expected_value: Math.round(districtRecords.length / 2),
        time_period: "Current dataset",
        explanation: `${rate(missing, districtRecords.length)}% of records are missing coordinates.`,
        recommended_action: "Improve FIR geotagging and data quality checks.",
        detected_at: new Date().toISOString()
      });
    }
  });
  return alerts.slice(0, 100);
}

function discoverPatterns(records) {
  const patterns = [];
  topN(records, "crime_type", 10).forEach((item, index) => {
    const scoped = records.filter((record) => record.crime_type === item.name);
    patterns.push({
      pattern_id: `crime-type-${index}`,
      pattern_type: "Repeated Crime Type Pattern",
      title: `${item.name} is a recurring crime pattern`,
      district: topN(scoped, "district", 1)[0]?.name || "",
      police_station: topN(scoped, "police_station", 1)[0]?.name || "",
      crime_type: item.name,
      count: item.value,
      severity: item.value > records.length * 0.2 ? "High" : "Medium",
      confidence_score: Math.min(95, Math.round((item.value / Math.max(records.length, 1)) * 100) + 50),
      time_period: getMonthlyTrend(scoped).at(-1)?.period || "Current dataset",
      explanation: `${item.name} appears ${item.value} times in the uploaded dataset.`,
      evidence: [`Current count: ${item.value}`, `Top district: ${topN(scoped, "district", 1)[0]?.name || "No data"}`],
      suggested_action: recommendedAction(item.name),
      recommended_action: recommendedAction(item.name),
      detected_at: new Date().toISOString()
    });
  });
  topN(records, "police_station", 10).forEach((item, index) => {
    const scoped = records.filter((record) => record.police_station === item.name);
    patterns.push({
      pattern_id: `station-${index}`,
      pattern_type: "Police Station Concentration",
      title: `${item.name} has concentrated case volume`,
      district: topN(scoped, "district", 1)[0]?.name || "",
      police_station: item.name,
      crime_type: topN(scoped, "crime_type", 1)[0]?.name || "Unknown",
      count: item.value,
      severity: item.value > records.length * 0.1 ? "High" : "Medium",
      confidence_score: Math.min(95, Math.round((item.value / Math.max(records.length, 1)) * 100) + 45),
      time_period: getMonthlyTrend(scoped).at(-1)?.period || "Current dataset",
      explanation: `${item.name} contributes a notable share of cases.`,
      evidence: [`Current count: ${item.value}`, `Dominant crime: ${topN(scoped, "crime_type", 1)[0]?.name || "No data"}`],
      suggested_action: "Review police station-level deployment and beat allocation.",
      recommended_action: "Review police station-level deployment and beat allocation.",
      detected_at: new Date().toISOString()
    });
  });
  return patterns;
}

function generateForecast(records, options = {}) {
  const monthly = getMonthlyTrend(records);
  const latest = monthly.at(-1)?.count || 0;
  const previous = monthly.slice(-4, -1);
  const expected = previous.length ? previous.reduce((sum, item) => sum + item.count, 0) / previous.length : latest;
  const topCrime = topN(records, "crime_type", 1)[0]?.name || "Unknown";
  const score = Math.min(Math.round((latest / Math.max(expected, 1)) * 50), 100);
  const date = options.forecast_date || new Date().toISOString().slice(0, 10);
  const label = options.forecast_label || date;
  const level = riskLevel(score);
  return {
    forecast_id: `FC-${options.forecast_id || Date.now()}`,
    district: options.district || topN(records, "district", 1)[0]?.name || "Karnataka",
    forecast_date: date,
    forecast_label: label,
    forecast_score: score,
    risk_score: score,
    risk_level: level,
    confidence_score: records.length ? 72 : 0,
    expected_crime_types: topN(records, "crime_type", 3).map((item) => item.name),
    expected_concern: topCrime,
    peak_risk_period: monthly.reduce((best, item) => item.count > (best?.count || 0) ? item : best, null)?.period || "No data",
    main_reason: `Forecast is based on recent FIR month trend and dominant crime type ${topCrime}.`,
    why_this_forecast: [
      `Latest period count: ${latest}`,
      `Previous period average: ${Math.round(expected)}`,
      `Dominant crime type: ${topCrime}`
    ],
    expected_crime_count: Math.round(expected),
    dominant_crime_type: topCrime,
    trend_direction: latest > expected * 1.1 ? "Increasing" : latest < expected * 0.9 ? "Decreasing" : "Stable",
    high_severity_probability: Math.min(100, pct(records.filter(isHeinous).length, records.length) + 10),
    explanation: "Rule-based forecast generated from uploaded FIR year/month trends.",
    recommended_action: recommendedAction(topCrime),
    generated_at: new Date().toISOString()
  };
}

function generateTimeMachine(records) {
  const timeline = getMonthlyTrend(records);
  const first = timeline[0];
  const latest = timeline.at(-1);
  return {
    timeline,
    comparison: {
      first_period: first?.period || "No data",
      latest_period: latest?.period || "No data",
      first_count: first?.count || 0,
      latest_count: latest?.count || 0,
      change: (latest?.count || 0) - (first?.count || 0)
    },
    movement: topN(records, "district", 10),
    insights: [
      `Timeline covers ${timeline.length} month periods.`,
      `Most frequent crime type is ${topN(records, "crime_type", 1)[0]?.name || "No data"}.`
    ]
  };
}

function filterOptions(records) {
  return {
    years: unique(records, "fir_year"),
    months: unique(records, "fir_month"),
    districts: unique(records, "district"),
    policeStations: unique(records, "police_station"),
    crimeTypes: unique(records, "crime_type"),
    severities: unique(records, "severity"),
    statuses: unique(records, "fir_stage"),
    fir_year: unique(records, "fir_year"),
    fir_month: unique(records, "fir_month"),
    district: unique(records, "district"),
    police_station: unique(records, "police_station"),
    crime_type: unique(records, "crime_type"),
    severity: unique(records, "severity"),
    fir_stage: unique(records, "fir_stage")
  };
}

function datasetSignature(records) {
  const lastUpdated = records.map((record) => record.created_time || record.MODIFIEDTIME || record.imported_at).filter(Boolean).sort().at(-1) || "";
  return `${records.length}:${lastUpdated}`;
}

function buildCrimeAnalyticsSummary(records) {
  const generatedAt = new Date().toISOString();
  const globalStats = getGlobalStats(records);
  const dashboardSummary = getDashboardSummary(records);
  const monthlyTrends = getMonthlyTrend(records);
  const yearlyTrends = getYearlyTrend(records);
  const crimeTypes = topN(records, "crime_type", 25).map((item) => ({ ...item, crime_type: item.name }));
  const districtRanking = topN(records, "district", 25).map((item) => ({ ...item, district: item.name }));
  const policeStationRanking = topN(records, "police_station", 25).map((item) => ({ ...item, police_station: item.name }));
  const crimeGroupRanking = topN(records, "crime_type", 25).map((item) => ({ ...item, crime_type: item.name }));
  const crimeHeadRanking = topN(records, "crime_subtype", 25).map((item) => ({ ...item, crime_subtype: item.name }));
  const firStageSummary = topN(records, "fir_stage", 25).map((item) => ({ ...item, fir_stage: item.name }));
  const complaintModeSummary = topN(records, "complaint_mode", 25).map((item) => ({ ...item, complaint_mode: item.name }));
  const recentRecords = [...records]
    .sort((a, b) => toNumber(b.ROWID) - toNumber(a.ROWID) || (b.created_time || "").localeCompare(a.created_time || ""))
    .slice(0, 25);
  const alerts = detectAnomalies(records);
  const patterns = discoverPatterns(records).slice(0, 100);
  const filters = filterOptions(records);
  return {
    cache_key: ANALYTICS_CACHE_KEY,
    cacheVersion: "v1",
    generatedAt,
    datasetSignature: datasetSignature(records),
    recordsAnalyzed: records.length,
    totalRecords: records.length,
    globalStats,
    dashboardSummary,
    monthlyTrends,
    yearlyTrends,
    crimeTypes,
    districtRanking,
    policeStationRanking,
    crimeGroupRanking,
    crimeHeadRanking,
    firStageSummary,
    complaintModeSummary,
    recentRecords,
    alerts,
    patterns,
    reportSummaryInputs: {
      recordsAnalyzed: records.length,
      topDistricts: districtRanking.slice(0, 10),
      topPoliceStations: policeStationRanking.slice(0, 10),
      topCrimeTypes: crimeTypes.slice(0, 10),
      yearlyTrends,
      monthlyTrends,
      coordinateCoverage: globalStats.coordinate_available_percentage,
      dataQualityScore: globalStats.data_quality_score
    },
    redZoneInputs: {
      topDistricts: districtRanking.slice(0, 10),
      topCrimeTypes: crimeTypes.slice(0, 10),
      severityCounts: topN(records, "severity", 10),
      latestPeriod: monthlyTrends.at(-1)?.period || ""
    },
    patternDiscoveryInputs: {
      topCrimeTypes: crimeTypes.slice(0, 10),
      topStations: policeStationRanking.slice(0, 10),
      topDistricts: districtRanking.slice(0, 10)
    },
    filterOptions: filters
  };
}

function cachedPayload(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

async function readAnalyticsCache(app, cacheKey = ANALYTICS_CACHE_KEY) {
  const memory = memoryCache.get(cacheKey);
  if (memory) return { ...memory, storage: "memory" };
  try {
    const table = app.datastore().table(ANALYTICS_CACHE_TABLE);
    const rows = unwrapRows(await table.getAllRows());
    const row = rows.map((item) => item?.[ANALYTICS_CACHE_TABLE] || item).find((item) => clean(item.cache_key) === cacheKey);
    const summary = cachedPayload(row?.cache_value_json);
    if (!summary) return null;
    const result = { summary, generatedAt: row.generated_at || summary.generatedAt, recordsAnalyzed: toNumber(row.records_analyzed || summary.recordsAnalyzed), datasetSignature: row.dataset_signature || summary.datasetSignature, cacheVersion: summary.cacheVersion || "v1", storage: "datastore" };
    memoryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn("[crimeAnalytics] AnalyticsCache read skipped", error.message);
    return null;
  }
}

async function writeAnalyticsCache(app, summary, cacheKey = ANALYTICS_CACHE_KEY) {
  const record = {
    cache_key: cacheKey,
    cache_value_json: JSON.stringify(summary),
    records_analyzed: summary.recordsAnalyzed || summary.totalRecords || 0,
    generated_at: summary.generatedAt || new Date().toISOString(),
    dataset_signature: summary.datasetSignature || ""
  };
  const memoryRecord = { summary, generatedAt: record.generated_at, recordsAnalyzed: record.records_analyzed, datasetSignature: record.dataset_signature, cacheVersion: summary.cacheVersion || "v1", storage: "memory" };
  memoryCache.set(cacheKey, memoryRecord);
  try {
    const table = app.datastore().table(ANALYTICS_CACHE_TABLE);
    const rows = unwrapRows(await table.getAllRows());
    const existing = rows.map((item) => item?.[ANALYTICS_CACHE_TABLE] || item).find((item) => clean(item.cache_key) === cacheKey);
    if (existing?.ROWID) await table.updateRow({ ROWID: existing.ROWID, ...record });
    else await table.insertRow(record);
    memoryCache.set(cacheKey, { ...memoryRecord, storage: "datastore" });
  } catch (error) {
    console.warn("[crimeAnalytics] AnalyticsCache Data Store write skipped; using in-memory cache", error.message);
  }
  return memoryCache.get(cacheKey);
}

async function rebuildAnalyticsCache(app, records) {
  const sourceRecords = records || await fetchCrimeRecords(app);
  const summary = buildCrimeAnalyticsSummary(sourceRecords);
  const cache = await writeAnalyticsCache(app, summary);
  return { summary, cache };
}

async function clearAnalyticsCache(app, cacheKey = ANALYTICS_CACHE_KEY) {
  memoryCache.delete(cacheKey);
  try {
    const table = app.datastore().table(ANALYTICS_CACHE_TABLE);
    const rows = unwrapRows(await table.getAllRows());
    const matches = rows.map((item) => item?.[ANALYTICS_CACHE_TABLE] || item).filter((item) => clean(item.cache_key) === cacheKey && item.ROWID);
    for (const row of matches) await table.deleteRow(row.ROWID);
    return matches.length;
  } catch (error) {
    console.warn("[crimeAnalytics] AnalyticsCache clear skipped", error.message);
    return 0;
  }
}

module.exports = {
  ANALYTICS_CACHE_KEY,
  ANALYTICS_CACHE_TABLE,
  CRIME_TABLE,
  applyFilters,
  buildCrimeAnalyticsSummary,
  calculateRiskScore,
  clearAnalyticsCache,
  detectAnomalies,
  discoverPatterns,
  fetchAllCrimeRecords,
  fetchCrimeRecords,
  forEachCrimeRecordPage,
  filterOptions,
  generateForecast,
  generateTimeMachine,
  getDashboardSummary,
  getGlobalStats,
  getMonthlyTrend,
  getYearlyTrend,
  groupCount,
  hasCoordinates,
  isHeinous,
  isNonHeinous,
  normalizeFilters,
  readAnalyticsCache,
  recommendedAction,
  rebuildAnalyticsCache,
  topN,
  toNumber,
  unique
};
