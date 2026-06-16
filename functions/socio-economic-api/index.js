const catalyst = require("zcatalyst-sdk-node");
const { applyFilters, fetchCrimeRecords, filterOptions, hasCoordinates, isHeinous, topN, toNumber, unique } = require("./crimeAnalytics");

const SERVICE_NAME = "socio-economic-api";
const DATA_NOTE = "Socio-economic insights are currently generated using crime-derived proxy indicators because no external socio-economic dataset is connected.";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /socio-economic/summary",
  "GET /socio-economic/district-profile",
  "GET /socio-economic/risk-indicators",
  "GET /socio-economic/correlation",
  "GET /socio-economic/vulnerability-index",
  "GET /socio-economic/insights",
  "GET /socio-economic/recommendations",
  "GET /socio-economic/filters"
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

function level(score) {
  if (score > 80) return "Critical";
  if (score > 60) return "High";
  if (score > 30) return "Medium";
  return "Low";
}

function score(part, max, weight = 100) {
  return max > 0 ? Math.min(weight, (part / max) * weight) : 0;
}

function districtGroups(records) {
  return records.reduce((acc, record) => {
    const district = clean(record.district) || "Unknown";
    acc[district] = acc[district] || [];
    acc[district].push(record);
    return acc;
  }, {});
}

function districtProfiles(records) {
  const groups = districtGroups(records);
  const maxCrimes = Math.max(...Object.values(groups).map((items) => items.length), 1);
  const maxVictims = Math.max(...Object.values(groups).map((items) => items.reduce((sum, row) => sum + toNumber(row.victim_count), 0)), 1);

  return Object.entries(groups).map(([district, rows]) => {
    const totalVictims = rows.reduce((sum, row) => sum + toNumber(row.victim_count), 0);
    const totalAccused = rows.reduce((sum, row) => sum + toNumber(row.accused_count), 0);
    const totalArrests = rows.reduce((sum, row) => sum + toNumber(row.arrested_count), 0);
    const totalConvictions = rows.reduce((sum, row) => sum + toNumber(row.conviction_count), 0);
    const heinousCount = rows.filter(isHeinous).length;
    const pendingCases = rows.filter((row) => clean(row.fir_stage).toLowerCase().includes("pending")).length;
    const topMode = topN(rows, "complaint_mode", 1)[0];
    const topStation = topN(rows, "police_station", 1)[0];
    const heinousShare = pct(heinousCount, rows.length);
    const arrestRate = pct(totalArrests, totalAccused);
    const convictionRate = pct(totalConvictions, totalAccused);
    const pendingShare = pct(pendingCases, rows.length);
    const coordinateAvailable = pct(rows.filter(hasCoordinates).length, rows.length);
    const stationConcentration = pct(topStation?.value || 0, rows.length);

    const publicSafety = Math.round(score(rows.length, maxCrimes));
    const vulnerabilityPressure = Math.round(score(totalVictims, maxVictims, 55) + heinousShare * 0.45);
    const legalGap = Math.max(0, 100 - Math.round((arrestRate * 0.45) + (convictionRate * 0.55)));
    const adminLoad = Math.round(pendingShare * 0.55 + stationConcentration * 0.45);
    const spatialReadiness = coordinateAvailable;
    const spatialWeakness = 100 - spatialReadiness;
    const communityRisk = Math.round(publicSafety * 0.4 + heinousShare * 0.3 + legalGap * 0.2 + stationConcentration * 0.1);
    const vulnerabilityIndex = Math.round(
      publicSafety * 0.25 +
      vulnerabilityPressure * 0.2 +
      heinousShare * 0.2 +
      legalGap * 0.15 +
      adminLoad * 0.1 +
      spatialWeakness * 0.1
    );

    return {
      district,
      total_crimes: rows.length,
      total_victims: totalVictims,
      total_accused: totalAccused,
      total_arrests: totalArrests,
      total_convictions: totalConvictions,
      heinous_share: heinousShare,
      arrest_rate: arrestRate,
      conviction_rate: convictionRate,
      pending_case_share: pendingShare,
      complaint_mode_dominance: topMode ? `${topMode.name} (${pct(topMode.value, rows.length)}%)` : "No data",
      coordinate_available_percentage: coordinateAvailable,
      public_safety_pressure_score: publicSafety,
      vulnerability_pressure_score: vulnerabilityPressure,
      legal_resolution_gap_score: legalGap,
      administrative_load_score: adminLoad,
      spatial_data_readiness_score: spatialReadiness,
      community_safety_risk_score: communityRisk,
      vulnerability_index: vulnerabilityIndex,
      risk_level: level(vulnerabilityIndex),
      dominant_crime_type: topN(rows, "crime_type", 1)[0]?.name || "No data",
      dominant_police_station: topStation?.name || "No data",
      main_insight: `${district} has ${rows.length} records with ${heinousShare}% heinous share and ${convictionRate}% conviction rate.`,
      prevention_strategies: [
        "Use crime-derived vulnerability indicators for patrol and case review planning.",
        "Connect official socio-economic datasets later for deeper causality analysis."
      ],
      population_density: 0,
      literacy_rate: 0,
      urbanization_rate: 0,
      migration_level: 0,
      unemployment_rate: 0,
      digital_access_score: 0,
      economic_stress_score: 0,
      youth_population_percentage: 0,
      updated_at: new Date().toISOString(),
      is_starter_estimate: true
    };
  }).sort((a, b) => b.vulnerability_index - a.vulnerability_index);
}

function summary(records, profiles) {
  const avg = profiles.length ? Math.round(profiles.reduce((sum, item) => sum + item.vulnerability_index, 0) / profiles.length) : 0;
  return {
    total_records_analyzed: records.length,
    total_districts: profiles.length,
    highest_vulnerability_district: profiles[0]?.district || "No data",
    highest_public_safety_pressure_district: [...profiles].sort((a, b) => b.public_safety_pressure_score - a.public_safety_pressure_score)[0]?.district || "No data",
    highest_resolution_gap_district: [...profiles].sort((a, b) => b.legal_resolution_gap_score - a.legal_resolution_gap_score)[0]?.district || "No data",
    average_vulnerability_index: avg,
    data_note: DATA_NOTE,
    districts_analyzed: profiles.length,
    highest_crime_density_district: [...profiles].sort((a, b) => b.total_crimes - a.total_crimes)[0]?.district || "No data",
    highest_cybercrime_risk_district: "Proxy indicators only",
    highest_property_crime_risk_district: "Proxy indicators only",
    strongest_socio_economic_correlation: "Crime-derived proxy relationships",
    data_completeness_score: Math.round(records.length ? profiles.reduce((sum, row) => sum + row.spatial_data_readiness_score, 0) / Math.max(profiles.length, 1) : 0),
    uses_starter_profiles: true
  };
}

function indicator(name, scoreValue, explanation, profiles, field) {
  const sorted = [...profiles].sort((a, b) => b[field] - a[field]);
  return {
    score: scoreValue,
    level: level(scoreValue),
    explanation,
    affected_districts: sorted.slice(0, 5).map((item) => item.district)
  };
}

function riskIndicators(profiles) {
  const avg = (field) => profiles.length ? Math.round(profiles.reduce((sum, item) => sum + item[field], 0) / profiles.length) : 0;
  return {
    public_safety_pressure: indicator("Public Safety Pressure", avg("public_safety_pressure_score"), "Based on district crime volume pressure.", profiles, "public_safety_pressure_score"),
    vulnerability_pressure: indicator("Vulnerability Pressure", avg("vulnerability_pressure_score"), "Based on victim_count and heinous crime share.", profiles, "vulnerability_pressure_score"),
    legal_resolution_gap: indicator("Legal Resolution Gap", avg("legal_resolution_gap_score"), "Based on accused_count versus arrested_count and conviction_count.", profiles, "legal_resolution_gap_score"),
    administrative_load: indicator("Administrative Load", avg("administrative_load_score"), "Based on FIR stage concentration, pending cases, and police station concentration.", profiles, "administrative_load_score"),
    spatial_data_readiness: indicator("Spatial Data Readiness", avg("spatial_data_readiness_score"), "Based on coordinate availability for spatial planning.", profiles, "spatial_data_readiness_score"),
    community_safety_risk: indicator("Community Safety Risk", avg("community_safety_risk_score"), "Combined score from concentration, heinous share, and conviction gap.", profiles, "community_safety_risk_score")
  };
}

function correlations() {
  return [
    {
      factor: "High crime volume",
      related_to: "Administrative load",
      relationship_strength: "High",
      explanation: "Districts with higher case volume may require more police resources."
    },
    {
      factor: "Low conviction count",
      related_to: "Legal resolution gap",
      relationship_strength: "Medium",
      explanation: "High accused count with low conviction count indicates follow-up pressure."
    },
    {
      factor: "Missing coordinates",
      related_to: "Spatial planning readiness",
      relationship_strength: "High",
      explanation: "Low coordinate availability limits hotspot precision."
    }
  ];
}

function vulnerabilityIndex(profiles) {
  return profiles.map((profile) => ({
    district: profile.district,
    vulnerability_index: profile.vulnerability_index,
    risk_level: profile.risk_level,
    main_driver: [
      ["Public safety pressure", profile.public_safety_pressure_score],
      ["Vulnerability pressure", profile.vulnerability_pressure_score],
      ["Legal resolution gap", profile.legal_resolution_gap_score],
      ["Administrative load", profile.administrative_load_score],
      ["Spatial data weakness", 100 - profile.spatial_data_readiness_score]
    ].sort((a, b) => b[1] - a[1])[0][0],
    supporting_metrics: {
      total_crimes: profile.total_crimes,
      heinous_share: profile.heinous_share,
      conviction_rate: profile.conviction_rate,
      coordinate_available_percentage: profile.coordinate_available_percentage
    }
  }));
}

function insights(profiles) {
  const top = profiles[0];
  const lowSpatial = [...profiles].sort((a, b) => a.coordinate_available_percentage - b.coordinate_available_percentage)[0];
  const legalGap = [...profiles].sort((a, b) => b.legal_resolution_gap_score - a.legal_resolution_gap_score)[0];
  const admin = [...profiles].sort((a, b) => b.administrative_load_score - a.administrative_load_score)[0];
  return [top, lowSpatial, legalGap, admin].filter(Boolean).map((profile, index) => {
    const templates = [
      {
        title: `${profile.district} shows concentrated reporting pressure.`,
        insight_type: "Public Safety Pressure",
        description: `${profile.district} has ${profile.total_crimes} crime records and vulnerability index ${profile.vulnerability_index}.`,
        impact: "May require stronger beat planning and resource allocation.",
        recommendation: "Increase beat planning and review police station concentration."
      },
      {
        title: `Low coordinate availability reduces spatial intervention accuracy.`,
        insight_type: "Spatial Data Readiness",
        description: `${profile.district} has ${profile.coordinate_available_percentage}% coordinate availability.`,
        impact: "Hotspot precision and location-based prevention may be limited.",
        recommendation: "Mandate location capture and FIR geotagging."
      },
      {
        title: `Legal resolution gap may require case follow-up strengthening.`,
        insight_type: "Legal Resolution Gap",
        description: `${profile.district} has ${profile.conviction_rate}% conviction rate and ${profile.arrest_rate}% arrest rate.`,
        impact: "Investigation and evidence tracking pressure may be high.",
        recommendation: "Improve investigation tracking and evidence management."
      },
      {
        title: `High FIR stage concentration indicates administrative workload.`,
        insight_type: "Administrative Load",
        description: `${profile.district} has ${profile.pending_case_share}% pending case share.`,
        impact: "Case review and disposal tracking may need attention.",
        recommendation: "Prioritize case review and workflow monitoring."
      }
    ];
    return {
      ...templates[index],
      district: profile.district,
      evidence: [
        `Vulnerability index: ${profile.vulnerability_index}`,
        `Total crimes: ${profile.total_crimes}`,
        `Risk level: ${profile.risk_level}`
      ],
      severity: profile.risk_level,
      recommended_actions: [templates[index].recommendation]
    };
  });
}

function recommendations(profiles) {
  const recs = [];
  profiles.slice(0, 8).forEach((profile) => {
    if (profile.public_safety_pressure_score > 60) recs.push({ priority: "High", title: "Increase beat planning", district: profile.district, action: "Increase beat planning and resource allocation.", reason: "High crime volume proxy pressure.", expected_impact: "Improved preventive deployment." });
    if (profile.vulnerability_pressure_score > 60) recs.push({ priority: "High", title: "Strengthen community safety", district: profile.district, action: "Strengthen community safety programs.", reason: "High victim pressure and heinous crime share.", expected_impact: "Better victim-focused prevention." });
    if (profile.legal_resolution_gap_score > 70) recs.push({ priority: "High", title: "Improve case follow-up", district: profile.district, action: "Improve investigation tracking and evidence management.", reason: "High legal resolution gap.", expected_impact: "Stronger case progression." });
    if (profile.administrative_load_score > 50) recs.push({ priority: "Medium", title: "Prioritize case review", district: profile.district, action: "Prioritize case review and pending-stage monitoring.", reason: "Administrative pending load is elevated.", expected_impact: "Reduced case workflow pressure." });
    if (profile.coordinate_available_percentage < 40) recs.push({ priority: "Medium", title: "Improve geotagging", district: profile.district, action: "Mandate location capture and geotagging.", reason: "Coordinate availability is low.", expected_impact: "Improved spatial planning readiness." });
  });
  return recs.slice(0, 20);
}

module.exports = async (req, res) => {
  const method = req.method;
  const path = getPath(req, SERVICE_NAME);
  console.log("[socio-economic-api] method:", method);
  console.log("[socio-economic-api] raw url:", req.url);
  console.log("[socio-economic-api] normalized path:", path);

  if (method === "OPTIONS") return send(res, 204, {});
  if (method === "GET" && path === "/") return send(res, 200, { success: true, service: SERVICE_NAME, message: "CrimePulse AI socio-economic-api is running", availableRoutes: AVAILABLE_ROUTES });
  if (method === "GET" && path === "/health") return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });

  try {
    const app = catalyst.initialize(req);
    const params = query(req);
    const allRecords = await fetchCrimeRecords(app);
    const records = applyFilters(allRecords, params);
    const profiles = districtProfiles(records);

    if (method === "GET" && path === "/socio-economic/summary") return send(res, 200, { success: true, data: summary(records, profiles) });
    if (method === "GET" && (path === "/socio-economic/district-profile" || path === "/socio-economic/profiles" || path === "/socio-economic/comparison")) return send(res, 200, { success: true, data: profiles, warning: DATA_NOTE });
    if (method === "GET" && path === "/socio-economic/risk-indicators") return send(res, 200, { success: true, data: riskIndicators(profiles) });
    if (method === "GET" && path === "/socio-economic/correlation") return send(res, 200, { success: true, data: correlations() });
    if (method === "GET" && path === "/socio-economic/vulnerability-index") return send(res, 200, { success: true, data: vulnerabilityIndex(profiles) });
    if (method === "GET" && path === "/socio-economic/insights") {
      return send(res, 200, {
        success: true,
        data: {
          overview: summary(records, profiles),
          insights: insights(profiles)
        },
        warning: DATA_NOTE
      });
    }
    if (method === "GET" && path === "/socio-economic/recommendations") return send(res, 200, { success: true, data: recommendations(profiles) });
    if (method === "GET" && path === "/socio-economic/filters") return send(res, 200, { success: true, data: { ...filterOptions(allRecords), districts: unique(allRecords, "district") } });

    return send(res, 404, { success: false, message: "Route not found", method, path, availableRoutes: AVAILABLE_ROUTES });
  } catch (error) {
    console.error("[socio-economic-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Socio-Economic Insights API failed",
      error: error.message,
      details: error.toString(),
      path,
      stack: error.stack
    });
  }
};
