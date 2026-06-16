const catalyst = require("zcatalyst-sdk-node");
const { applyFilters, fetchCrimeRecords, filterOptions, isHeinous, topN, toNumber } = require("./crimeAnalytics");

const SERVICE_NAME = "map-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /map/summary",
  "GET /map/crime-points",
  "GET /map/hotspots",
  "GET /map/district-intensity",
  "GET /map/police-station-intensity",
  "GET /map/heatmap",
  "GET /map/filters"
];
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
const KARNATAKA_CENTER = { latitude: 15.3173, longitude: 75.7139 };
const DISTRICT_CENTROIDS = {
  Bagalkot: { latitude: 16.1725, longitude: 75.6557 },
  "Bengaluru City": { latitude: 12.9716, longitude: 77.5946 },
  "Bengaluru Urban": { latitude: 12.9716, longitude: 77.5946 },
  "Bengaluru Rural": { latitude: 13.2847, longitude: 77.6078 },
  Belagavi: { latitude: 15.8497, longitude: 74.4977 },
  Ballari: { latitude: 15.1394, longitude: 76.9214 },
  Bellary: { latitude: 15.1394, longitude: 76.9214 },
  Bidar: { latitude: 17.9104, longitude: 77.5199 },
  Chamarajanagar: { latitude: 11.9261, longitude: 76.9437 },
  Chikkaballapura: { latitude: 13.4355, longitude: 77.7315 },
  Chikkamagaluru: { latitude: 13.3161, longitude: 75.772 },
  Chitradurga: { latitude: 14.2251, longitude: 76.398 },
  "Dakshina Kannada": { latitude: 12.9141, longitude: 74.856 },
  Mangaluru: { latitude: 12.9141, longitude: 74.856 },
  Davanagere: { latitude: 14.4644, longitude: 75.9218 },
  Dharwad: { latitude: 15.4589, longitude: 75.0078 },
  Gadag: { latitude: 15.4315, longitude: 75.6355 },
  Hassan: { latitude: 13.0033, longitude: 76.1004 },
  Haveri: { latitude: 14.7951, longitude: 75.3991 },
  Kalaburagi: { latitude: 17.3297, longitude: 76.8343 },
  Gulbarga: { latitude: 17.3297, longitude: 76.8343 },
  Kodagu: { latitude: 12.3375, longitude: 75.8069 },
  Kolar: { latitude: 13.1367, longitude: 78.129 },
  Koppal: { latitude: 15.3505, longitude: 76.1567 },
  Mandya: { latitude: 12.5218, longitude: 76.8951 },
  Mysuru: { latitude: 12.2958, longitude: 76.6394 },
  Mysore: { latitude: 12.2958, longitude: 76.6394 },
  Raichur: { latitude: 16.212, longitude: 77.3439 },
  Ramanagara: { latitude: 12.72, longitude: 77.281 },
  Shivamogga: { latitude: 13.9299, longitude: 75.5681 },
  Shimoga: { latitude: 13.9299, longitude: 75.5681 },
  Tumakuru: { latitude: 13.3409, longitude: 77.101 },
  Tumkur: { latitude: 13.3409, longitude: 77.101 },
  Udupi: { latitude: 13.3409, longitude: 74.7421 },
  "Uttara Kannada": { latitude: 14.8185, longitude: 74.1416 },
  Vijayapura: { latitude: 16.8302, longitude: 75.71 },
  Bijapur: { latitude: 16.8302, longitude: 75.71 },
  Yadgir: { latitude: 16.77, longitude: 77.1376 }
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

function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
}

function getDistrictCentroid(district = "") {
  const exact = DISTRICT_CENTROIDS[clean(district)];
  if (exact) return { ...exact, coordinate_source: "district_fallback" };
  const lower = clean(district).toLowerCase();
  const fuzzyKey = Object.keys(DISTRICT_CENTROIDS).find((key) => lower && (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)));
  return fuzzyKey ? { ...DISTRICT_CENTROIDS[fuzzyKey], coordinate_source: "district_fallback" } : { ...KARNATAKA_CENTER, coordinate_source: "karnataka_fallback" };
}

function getCoordinates(record) {
  const latitude = toNumber(record.latitude_value);
  const longitude = toNumber(record.longitude_value);
  if (validCoordinate(latitude, longitude)) {
    return { latitude, longitude, coordinate_source: "original" };
  }
  return getDistrictCentroid(record.district);
}

function riskLevel(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function intensityScore(count, maxCount, heinousShare = 0) {
  const volume = maxCount > 0 ? (count / maxCount) * 75 : 0;
  return Math.min(100, Math.round(volume + heinousShare * 0.25));
}

function pointFromRecord(record, index) {
  const coordinates = getCoordinates(record);
  return {
    id: record.ROWID || record.crime_id || `crime-${index}`,
    crime_id: record.crime_id,
    district: record.district,
    police_station: record.police_station,
    crime_type: record.crime_type,
    crime_subtype: record.crime_subtype,
    severity: record.severity,
    fir_year: record.fir_year,
    fir_month: record.fir_month,
    fir_day: record.fir_day,
    crime_date: record.crime_date,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    coordinate_source: coordinates.coordinate_source,
    intensity: ["High", "Critical"].includes(record.severity) || isHeinous(record) ? 1 : 0.6,
    location: record.offence_location,
    status: record.fir_stage,
    date: record.crime_date,
    popup: {
      title: record.crime_id || record.crime_type || "Crime record",
      district: record.district,
      police_station: record.police_station,
      crime_type: record.crime_type,
      crime_subtype: record.crime_subtype,
      severity: record.severity,
      date: record.crime_date,
      fir_stage: record.fir_stage
    }
  };
}

function groupRecords(records, keyFn) {
  return records.reduce((acc, record) => {
    const key = keyFn(record);
    acc[key] = acc[key] || [];
    acc[key].push(record);
    return acc;
  }, {});
}

function buildHotspots(records) {
  const groups = groupRecords(records, (record) => `${record.district || "Unknown"}||${record.police_station || "Unknown"}`);
  const maxCount = Math.max(...Object.values(groups).map((items) => items.length), 1);
  return Object.entries(groups).map(([key, scoped], index) => {
    const [district, policeStation] = key.split("||");
    const originalCoordinateRecords = scoped.filter((record) => getCoordinates(record).coordinate_source === "original");
    const coordinateRecords = originalCoordinateRecords.length ? originalCoordinateRecords : scoped;
    const averaged = coordinateRecords.reduce((acc, record) => {
      const coordinates = getCoordinates(record);
      acc.latitude += coordinates.latitude;
      acc.longitude += coordinates.longitude;
      return acc;
    }, { latitude: 0, longitude: 0 });
    const heinousCount = scoped.filter(isHeinous).length;
    const heinousShare = pct(heinousCount, scoped.length);
    const score = intensityScore(scoped.length, maxCount, heinousShare);
    const source = originalCoordinateRecords.length ? "original" : getCoordinates(scoped[0] || {}).coordinate_source;
    return {
      hotspot_id: `HS-${index}-${district}-${policeStation}`.replace(/\s+/g, "-"),
      district,
      police_station: policeStation,
      latitude: Number((averaged.latitude / coordinateRecords.length).toFixed(6)),
      longitude: Number((averaged.longitude / coordinateRecords.length).toFixed(6)),
      center_latitude: Number((averaged.latitude / coordinateRecords.length).toFixed(6)),
      center_longitude: Number((averaged.longitude / coordinateRecords.length).toFixed(6)),
      crime_count: scoped.length,
      risk_level: riskLevel(score),
      top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "Unknown",
      dominant_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "Unknown",
      heinous_count: heinousCount,
      intensity_score: score,
      risk_score: score,
      coordinate_source: source,
      recommended_action: "Deploy focused patrol and review hotspot beat allocation."
    };
  }).sort((a, b) => b.intensity_score - a.intensity_score || b.crime_count - a.crime_count);
}

function buildDistrictIntensity(records) {
  const groups = groupRecords(records, (record) => record.district || "Unknown");
  const maxCount = Math.max(...Object.values(groups).map((items) => items.length), 1);
  return Object.entries(groups).map(([district, scoped]) => {
    const centroid = getDistrictCentroid(district);
    const heinousCount = scoped.filter(isHeinous).length;
    const score = intensityScore(scoped.length, maxCount, pct(heinousCount, scoped.length));
    return {
      district,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      crime_count: scoped.length,
      police_station_count: new Set(scoped.map((record) => record.police_station).filter(Boolean)).size,
      top_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "Unknown",
      dominant_crime_type: topN(scoped, "crime_type", 1)[0]?.name || "Unknown",
      heinous_count: heinousCount,
      intensity_score: score,
      risk_level: riskLevel(score),
      intensity_level: riskLevel(score)
    };
  }).sort((a, b) => b.intensity_score - a.intensity_score || b.crime_count - a.crime_count);
}

function buildHeatmap(hotspots) {
  const maxCount = Math.max(...hotspots.map((hotspot) => hotspot.crime_count), 1);
  return hotspots.map((hotspot) => ({
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    weight: Number((hotspot.crime_count / maxCount).toFixed(3)),
    district: hotspot.district,
    police_station: hotspot.police_station,
    crime_type: hotspot.top_crime_type || hotspot.dominant_crime_type || "Unknown",
    coordinate_source: hotspot.coordinate_source
  }));
}

function summary(records, hotspots, districts) {
  const withCoordinates = records.filter((record) => getCoordinates(record).coordinate_source === "original").length;
  const fallback = records.length - withCoordinates;
  return {
    total_records: records.length,
    records_with_coordinates: withCoordinates,
    records_without_coordinates: fallback,
    records_using_fallback_coordinates: fallback,
    coordinate_available_percentage: pct(withCoordinates, records.length),
    total_districts: new Set(records.map((record) => record.district).filter(Boolean)).size,
    total_police_stations: new Set(records.map((record) => record.police_station).filter(Boolean)).size,
    hotspot_count: hotspots.length,
    active_hotspots: hotspots.length,
    highest_intensity_district: districts[0]?.district || "No data",
    highest_risk_district: districts[0]?.district || "No data",
    highest_intensity_police_station: hotspots[0]?.police_station || "No data",
    most_common_mapped_crime_type: topN(records, "crime_type", 1)[0]?.name || "No data",
    fallback_used: fallback > 0
  };
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[map-api] method:", method);
  console.log("[map-api] raw url:", req.url);
  console.log("[map-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI map-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const params = query(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);
    const hotspots = buildHotspots(records);
    const districts = buildDistrictIntensity(records);
    const limit = Math.max(1, Math.min(Number(params.limit || 2000), 5000));

    if (method === "GET" && path === "/map/summary") return send(res, 200, { success: true, data: summary(records, hotspots, districts) });
    if (method === "GET" && path === "/map/crime-points") return send(res, 200, { success: true, data: records.slice(0, limit).map(pointFromRecord) });
    if (method === "GET" && path === "/map/hotspots") return send(res, 200, { success: true, data: hotspots.slice(0, 500) });
    if (method === "GET" && path === "/map/district-intensity") return send(res, 200, { success: true, data: districts });
    if (method === "GET" && path === "/map/police-station-intensity") return send(res, 200, { success: true, data: hotspots.slice(0, 500) });
    if (method === "GET" && path === "/map/heatmap") return send(res, 200, { success: true, data: buildHeatmap(hotspots).slice(0, 500) });
    if (method === "GET" && path === "/map/filters") return send(res, 200, { success: true, data: filterOptions(allRecords) });

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[map-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Map API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
