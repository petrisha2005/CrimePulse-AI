const catalyst = require("zcatalyst-sdk-node");
const {
  applyFilters,
  fetchCrimeRecords,
  filterOptions,
  getDashboardSummary,
  getGlobalStats,
  getMonthlyTrend,
  getYearlyTrend,
  hasCoordinates,
  isHeinous,
  isNonHeinous,
  readAnalyticsCache,
  rebuildAnalyticsCache,
  topN,
  toNumber
} = require("./crimeAnalytics");

const SERVICE_NAME = "dashboard-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /dashboard/debug",
  "GET /dashboard/global-stats",
  "GET /dashboard/summary",
  "GET /dashboard/monthly-trends",
  "GET /dashboard/yearly-trends",
  "GET /dashboard/crime-types",
  "GET /dashboard/district-ranking",
  "GET /dashboard/police-station-ranking",
  "GET /dashboard/crime-group-ranking",
  "GET /dashboard/crime-head-ranking",
  "GET /dashboard/fir-stage-summary",
  "GET /dashboard/complaint-mode-summary",
  "GET /dashboard/recent-records",
  "GET /dashboard/filters",
  "POST /analytics/rebuild",
  "POST /dashboard/analytics/rebuild",
  "GET /dashboard/district-analytics/summary",
  "GET /dashboard/district-analytics/ranking",
  "GET /dashboard/district-analytics/:district",
  "GET /dashboard/district-analytics/:district/trends",
  "GET /dashboard/district-analytics/:district/crime-types",
  "GET /dashboard/district-analytics/:district/police-stations",
  "GET /dashboard/district-analytics/:district/fir-stages",
  "GET /dashboard/district-analytics/:district/complaint-modes",
  "GET /dashboard/district-analytics/filters"
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
  const urlOnly = (req.url || "/").split("?")[0];
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

function isActiveFilter(value) {
  const normalized = clean(value).toLowerCase();
  return normalized !== "" && normalized !== "all";
}

function dashboardAppliedFilters(params = {}) {
  const candidates = {
    fir_year: params.fir_year || params.year || params.firYear,
    fir_month: params.fir_month || params.month || params.firMonth,
    district: params.district,
    police_station: params.police_station || params.policeStation,
    crime_type: params.crime_type || params.crime_group || params.crimeType,
    crime_subtype: params.crime_subtype,
    severity: params.severity || params.fir_type || params.firType,
    fir_stage: params.fir_stage || params.status || params.firStage,
    complaint_mode: params.complaint_mode || params.complaintMode,
    dataset_id: params.dataset_id
  };
  return Object.fromEntries(Object.entries(candidates).filter(([, value]) => isActiveFilter(value)).map(([key, value]) => [key, clean(value)]));
}

function dashboardMeta(allRecords, records, params = {}, cache = {}) {
  const appliedFilters = dashboardAppliedFilters(params);
  const isFiltered = Object.keys(appliedFilters).length > 0;
  return {
    totalUploadedRecords: allRecords.length,
    recordsAnalyzed: records.length,
    analysisScope: isFiltered ? "filtered_dataset" : "full_dataset",
    isFiltered,
    isSampled: false,
    isCached: Boolean(cache.isCached),
    cacheGeneratedAt: cache.cacheGeneratedAt || "",
    cacheVersion: cache.cacheVersion || "",
    durationMs: cache.durationMs || 0,
    appliedFilters
  };
}

function sendData(res, data, allRecords, records, params, cache) {
  return send(res, 200, { success: true, data, meta: dashboardMeta(allRecords, records, params, cache) });
}

function chart(items, field = "name") {
  return items.map((item) => ({ ...item, [field]: item.name }));
}

function recentRecords(records) {
  return [...records]
    .sort((a, b) => toNumber(b.ROWID) - toNumber(a.ROWID) || (b.created_time || "").localeCompare(a.created_time || ""))
    .slice(0, 25)
    .map((record) => ({
      ROWID: record.ROWID,
      crime_id: record.crime_id,
      district: record.district,
      police_station: record.police_station,
      crime_type: record.crime_type,
      crime_subtype: record.crime_subtype,
      severity: record.severity,
      severity_original: record.severity_original,
      fir_year: toNumber(record.fir_year),
      fir_month: toNumber(record.fir_month),
      fir_day: toNumber(record.fir_day),
      crime_date: record.crime_date,
      fir_stage: record.fir_stage,
      complaint_mode: record.complaint_mode
    }));
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const cachedRouteMap = {
  "/dashboard/global-stats": "globalStats",
  "/dashboard/summary": "dashboardSummary",
  "/dashboard/monthly-trends": "monthlyTrends",
  "/dashboard/yearly-trends": "yearlyTrends",
  "/dashboard/crime-types": "crimeTypes",
  "/dashboard/district-ranking": "districtRanking",
  "/dashboard/police-station-ranking": "policeStationRanking",
  "/dashboard/crime-group-ranking": "crimeGroupRanking",
  "/dashboard/crime-head-ranking": "crimeHeadRanking",
  "/dashboard/fir-stage-summary": "firStageSummary",
  "/dashboard/complaint-mode-summary": "complaintModeSummary",
  "/dashboard/recent-records": "recentRecords",
  "/dashboard/filters": "filterOptions"
};

function hasDashboardFilters(params) {
  return Object.keys(dashboardAppliedFilters(params)).length > 0;
}

function sendCachedRoute(res, path, params, cache, startedAt) {
  const key = cachedRouteMap[path];
  if (!key || !cache?.summary) return false;
  const data = cache.summary[key];
  if (data === undefined) return false;
  const total = Number(cache.summary.totalRecords || cache.summary.recordsAnalyzed || cache.recordsAnalyzed || 0);
  const meta = {
    totalUploadedRecords: total,
    recordsAnalyzed: total,
    analysisScope: "full_dataset",
    isFiltered: false,
    isSampled: false,
    isCached: true,
    cacheGeneratedAt: cache.generatedAt || cache.summary.generatedAt || "",
    cacheVersion: cache.cacheVersion || cache.summary.cacheVersion || "v1",
    durationMs: Date.now() - startedAt,
    appliedFilters: {}
  };
  return send(res, 200, { success: true, data, meta });
}

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function groupBy(records, field) {
  return records.reduce((acc, record) => {
    const key = String(record[field] || "Unknown").trim() || "Unknown";
    acc[key] = acc[key] || [];
    acc[key].push(record);
    return acc;
  }, {});
}

function sumField(records, field) {
  return records.reduce((sum, record) => sum + toNumber(record[field]), 0);
}

function districtMonthlyTrend(records) {
  const grouped = records.reduce((acc, record) => {
    const year = String(record.fir_year || "Unknown");
    const month = String(record.fir_month || "Unknown");
    const period = year !== "Unknown" && month !== "Unknown" ? `${year}-${String(month).padStart(2, "0")}` : "Unknown";
    acc[period] = acc[period] || [];
    acc[period].push(record);
    return acc;
  }, {});
  return Object.entries(grouped)
    .filter(([period]) => period !== "Unknown")
    .map(([period, scoped]) => {
      const [year, month] = period.split("-");
      return {
        period,
        year,
        month: String(Number(month)),
        total_crimes: scoped.length,
        heinous_count: scoped.filter(isHeinous).length,
        top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data"
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

function calculateDistrictRisk(districtRecords, allRecords, maxDistrictCount) {
  const crimeVolumeScore = maxDistrictCount > 0 ? (districtRecords.length / maxDistrictCount) * 30 : 0;
  const heinousScore = pct(districtRecords.filter(isHeinous).length, districtRecords.length) * 0.2;
  const topStationShare = pct(topN(districtRecords, "police_station", 1)[0]?.value || 0, districtRecords.length);
  const concentrationScore = topStationShare * 0.15;
  const accused = sumField(districtRecords, "accused_count");
  const arrested = sumField(districtRecords, "arrested_count");
  const convictions = sumField(districtRecords, "conviction_count");
  const arrestRate = pct(arrested, accused);
  const convictionRate = pct(convictions, accused);
  const gapScore = Math.max(0, 100 - Math.round((arrestRate * 0.45) + (convictionRate * 0.55))) * 0.15;
  const trend = districtMonthlyTrend(districtRecords);
  const latest = trend.at(-1)?.total_crimes || 0;
  const previous = trend.slice(-4, -1);
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.total_crimes, 0) / previous.length : latest;
  const trendScore = Math.min(10, (latest / Math.max(previousAverage, 1)) * 5);
  const qualityScore = pct(districtRecords.filter(hasCoordinates).length, districtRecords.length) * 0.1;
  return Math.round(Math.min(100, crimeVolumeScore + heinousScore + concentrationScore + gapScore + trendScore + qualityScore));
}

function districtRanking(records) {
  const grouped = groupBy(records, "district");
  const maxDistrictCount = Math.max(...Object.values(grouped).map((items) => items.length), 1);
  return Object.entries(grouped)
    .map(([district, scoped]) => {
      const risk_score = calculateDistrictRisk(scoped, records, maxDistrictCount);
      return {
        district,
        total_crimes: scoped.length,
        crime_share_percentage: pct(scoped.length, records.length),
        risk_score,
        risk_level: riskLevel(risk_score),
        top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data",
        top_police_station: topN(scoped, "police_station", 1)[0]?.name || "No data",
        heinous_count: scoped.filter(isHeinous).length,
        non_heinous_count: scoped.filter(isNonHeinous).length,
        victim_count: sumField(scoped, "victim_count"),
        accused_count: sumField(scoped, "accused_count"),
        arrested_count: sumField(scoped, "arrested_count"),
        conviction_count: sumField(scoped, "conviction_count"),
        coordinate_available_percentage: pct(scoped.filter(hasCoordinates).length, scoped.length)
      };
    })
    .sort((a, b) => b.total_crimes - a.total_crimes)
    .map((item, index) => ({ rank: index + 1, ...item }));
}

function districtAnalyticsSummary(records) {
  const ranking = districtRanking(records);
  const highestRisk = [...ranking].sort((a, b) => b.risk_score - a.risk_score)[0];
  const quality = pct(records.filter((record) => record.district && record.police_station && record.crime_type).length, records.length);
  return {
    total_districts: ranking.length,
    total_records: records.length,
    highest_crime_district: ranking[0]?.district || "No data",
    lowest_crime_district: ranking.at(-1)?.district || "No data",
    average_crimes_per_district: ranking.length ? Math.round(records.length / ranking.length) : 0,
    highest_risk_district: highestRisk?.district || "No data",
    most_common_crime_type: topN(records, "crime_type", 1)[0]?.name || "No data",
    district_coverage_quality: quality
  };
}

function districtProfile(records, district) {
  const scoped = records.filter((record) => record.district === district);
  const ranking = districtRanking(records);
  const ranked = ranking.find((item) => item.district === district);
  const accused = sumField(scoped, "accused_count");
  const arrested = sumField(scoped, "arrested_count");
  const convictions = sumField(scoped, "conviction_count");
  const topCrime = topN(scoped, "crime_type", 1)[0]?.name || "No data";
  const topStation = topN(scoped, "police_station", 1)[0]?.name || "No data";
  const coordinatePct = pct(scoped.filter(hasCoordinates).length, scoped.length);
  return {
    district,
    total_crimes: scoped.length,
    crime_share_percentage: pct(scoped.length, records.length),
    total_police_stations: new Set(scoped.map((record) => record.police_station).filter(Boolean)).size,
    top_police_station: topStation,
    top_crime_type: topCrime,
    top_crime_subtype: topN(scoped, "crime_subtype", 1)[0]?.name || "No data",
    heinous_count: scoped.filter(isHeinous).length,
    non_heinous_count: scoped.filter(isNonHeinous).length,
    victim_count: sumField(scoped, "victim_count"),
    accused_count: accused,
    arrested_count: arrested,
    conviction_count: convictions,
    arrest_rate: pct(arrested, accused),
    conviction_rate: pct(convictions, accused),
    coordinate_available_percentage: coordinatePct,
    risk_score: ranked?.risk_score || 0,
    risk_level: ranked?.risk_level || "Low",
    operational_summary: `${district} has ${scoped.length} records. ${topCrime} is the leading crime type and ${topStation} is the top contributing police station.`,
    key_observations: [
      `${pct(scoped.length, records.length)}% of filtered records belong to ${district}.`,
      `${topCrime} is the most reported crime type.`,
      `${coordinatePct}% coordinate availability for spatial analysis.`,
      `${pct(scoped.filter(isHeinous).length, scoped.length)}% heinous/high severity share.`
    ],
    recommended_actions: [
      `Review beat deployment around ${topStation}.`,
      `Prioritize preventive action for ${topCrime}.`,
      coordinatePct < 40 ? "Improve FIR geotagging for district-level hotspot accuracy." : "Maintain coordinate capture quality.",
      pct(convictions, accused) < 10 ? "Strengthen evidence tracking and case follow-up." : "Continue case follow-up monitoring."
    ]
  };
}

function groupedChart(records, field, labelField) {
  return topN(records, field, 50).map((item) => ({
    [labelField]: item.name,
    name: item.name,
    count: item.value,
    value: item.value,
    percentage: pct(item.value, records.length)
  }));
}

module.exports = async (req, res) => {
  const path = getPath(req, SERVICE_NAME);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && path === "/") {
    return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI dashboard-api is running", availableRoutes: AVAILABLE_ROUTES });
  }
  if (req.method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const startedAt = Date.now();
    const app = catalyst.initialize(req);
    const params = query(req);
    const filteredRequest = hasDashboardFilters(params);

    if (req.method === "POST" && (path === "/analytics/rebuild" || path === "/dashboard/analytics/rebuild")) {
      const allRecords = await fetchCrimeRecords(app);
      const { summary, cache } = await rebuildAnalyticsCache(app, allRecords);
      return send(res, 200, {
        success: true,
        message: "Analytics cache rebuilt",
        recordsAnalyzed: summary.recordsAnalyzed,
        generatedAt: summary.generatedAt,
        cacheVersion: summary.cacheVersion,
        cacheStorage: cache?.storage || "memory",
        durationMs: Date.now() - startedAt,
        meta: {
          totalUploadedRecords: summary.totalRecords,
          recordsAnalyzed: summary.recordsAnalyzed,
          analysisScope: "full_dataset",
          isFiltered: false,
          isCached: true,
          cacheGeneratedAt: summary.generatedAt,
          cacheVersion: summary.cacheVersion,
          durationMs: Date.now() - startedAt,
          appliedFilters: {}
        }
      });
    }

    if (req.method === "GET" && !filteredRequest && cachedRouteMap[path]) {
      const cache = await readAnalyticsCache(app);
      if (cache && sendCachedRoute(res, path, params, cache, startedAt)) return;
    }

    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);
    const cacheInfo = { isCached: false, durationMs: Date.now() - startedAt };

    if (req.method === "GET" && path === "/dashboard/debug") {
      const sampleRow = allRecords[0] || null;
      return send(res, 200, {
        success: true,
        step: "Fetched CrimeRecords using shared analytics utility",
        tableAccess: true,
        sampleRow,
        rowKeys: sampleRow ? Object.keys(sampleRow) : [],
        fetchedCount: allRecords.length,
        message: allRecords.length > 0 ? "CrimeRecords fetched and normalized successfully." : "CrimeRecords fetched successfully, but no rows were returned."
      });
    }
    if (req.method === "GET" && path === "/dashboard/global-stats") return sendData(res, getGlobalStats(allRecords), allRecords, allRecords, {}, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/summary") return sendData(res, getDashboardSummary(records), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/monthly-trends") return sendData(res, getMonthlyTrend(records), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/yearly-trends") return sendData(res, getYearlyTrend(records), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/crime-types") return sendData(res, chart(topN(records, "crime_type", 25), "crime_type"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/district-ranking") return sendData(res, chart(topN(records, "district", 10), "district"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/police-station-ranking") return sendData(res, chart(topN(records, "police_station", 10), "police_station"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/crime-group-ranking") return sendData(res, chart(topN(records, "crime_type", 10), "crime_type"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/crime-head-ranking") return sendData(res, chart(topN(records, "crime_subtype", 10), "crime_subtype"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/fir-stage-summary") return sendData(res, chart(topN(records, "fir_stage", 25), "fir_stage"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/complaint-mode-summary") return sendData(res, chart(topN(records, "complaint_mode", 25), "complaint_mode"), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/recent-records") return sendData(res, recentRecords(records), allRecords, records, params, cacheInfo);
    if (req.method === "GET" && path === "/dashboard/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });
    if (req.method === "GET" && path === "/dashboard/district-analytics/summary") return send(res, 200, { success: true, data: districtAnalyticsSummary(records) });
    if (req.method === "GET" && path === "/dashboard/district-analytics/ranking") return send(res, 200, { success: true, data: districtRanking(records) });
    if (req.method === "GET" && path === "/dashboard/district-analytics/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });

    if (req.method === "GET" && path.startsWith("/dashboard/district-analytics/")) {
      const rest = path.replace("/dashboard/district-analytics/", "");
      const [encodedDistrict, childRoute] = rest.split("/");
      const district = decodeURIComponent(encodedDistrict || "");
      const districtRecords = records.filter((record) => record.district === district);

      if (childRoute === "trends") return send(res, 200, { success: true, data: districtMonthlyTrend(districtRecords) });
      if (childRoute === "crime-types") {
        return send(res, 200, {
          success: true,
          data: topN(districtRecords, "crime_type", 50).map((item) => {
            const scoped = districtRecords.filter((record) => record.crime_type === item.name);
            return {
              crime_type: item.name,
              name: item.name,
              count: item.value,
              value: item.value,
              percentage: pct(item.value, districtRecords.length),
              top_crime_subtype: topN(scoped, "crime_subtype", 1)[0]?.name || "No data"
            };
          })
        });
      }
      if (childRoute === "police-stations") {
        const maxCount = Math.max(...topN(districtRecords, "police_station", 500).map((item) => item.value), 1);
        return send(res, 200, {
          success: true,
          data: topN(districtRecords, "police_station", 100).map((item) => {
            const scoped = districtRecords.filter((record) => record.police_station === item.name);
            const risk_score = Math.round(Math.min(100, (item.value / maxCount) * 75 + pct(scoped.filter(isHeinous).length, scoped.length) * 0.25));
            return {
              police_station: item.name,
              name: item.name,
              count: item.value,
              value: item.value,
              percentage: pct(item.value, districtRecords.length),
              risk_score,
              risk_level: riskLevel(risk_score),
              top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "No data"
            };
          })
        });
      }
      if (childRoute === "fir-stages") return send(res, 200, { success: true, data: groupedChart(districtRecords, "fir_stage", "fir_stage") });
      if (childRoute === "complaint-modes") return send(res, 200, { success: true, data: groupedChart(districtRecords, "complaint_mode", "complaint_mode") });
      if (!childRoute) return send(res, 200, { success: true, data: districtProfile(records, district) });
    }

    return send(res, 404, { success: false, message: "Route not found", method: req.method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[dashboard-api] request failed", error);
    return send(res, 500, { success: false, message: "Dashboard API failed", error: error.message, details: error.toString(), path, stack: error.stack });
  }
};
