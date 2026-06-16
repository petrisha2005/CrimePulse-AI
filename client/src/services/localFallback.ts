import type {
  AlertCharts,
  AlertFilterOptions,
  AlertSummary,
  AiInsightFilterOptions,
  DashboardFilterOptions,
  DashboardSummary,
  ForecastFilterOptions,
  GlobalStats,
  MapFilterOptions,
  MapSummary,
  SocioEconomicCorrelation,
  SocioEconomicFilterOptions,
  PatternCharts,
  PatternFilterOptions,
  PatternSummary,
  GeneratedReportResponse,
  TimeMachineFilterOptions
} from "../types/crime";

const emptyDashboardSummary: DashboardSummary = {
  totalCrimes: 0,
  totalDistricts: 0,
  totalPoliceStations: 0,
  mostReportedCrimeType: "No data",
  heinousCrimeCount: 0,
  nonHeinousCrimeCount: 0,
  highSeverityCrimes: 0,
  totalVictims: 0,
  totalAccused: 0,
  totalArrests: 0,
  totalConvictions: 0,
  coordinateAvailablePercentage: 0
};

const emptyDashboardFilters: DashboardFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const emptyGlobalStats: GlobalStats = {
  total_records: 0,
  total_districts: 0,
  total_police_stations: 0,
  year_range: "No data",
  total_crime_groups: 0,
  records_with_coordinates: 0,
  records_without_coordinates: 0,
  coordinate_available_percentage: 0,
  data_quality_score: 0,
  last_updated: ""
};

const emptyAlertSummary: AlertSummary = {
  totalActiveAlerts: 0,
  criticalAlerts: 0,
  highRiskDistricts: 0,
  mostCommonAlertType: "No alerts",
  latestAlertTime: "No alerts"
};

const emptyAlertCharts: AlertCharts = {
  spikeComparison: [],
  districtAnomalyCounts: [],
  severityDistribution: [],
  monthlyAnomalyTrend: []
};

const emptyAlertFilters: AlertFilterOptions = {
  districts: [],
  crimeTypes: [],
  severities: ["Critical", "High", "Medium", "Low"],
  alertTypes: [],
  years: [],
  months: []
};

const emptyMapSummary: MapSummary = {
  total_records: 0,
  records_with_coordinates: 0,
  records_without_coordinates: 0,
  active_hotspots: 0,
  highest_risk_district: "No data",
  most_common_mapped_crime_type: "No data"
};

const emptyMapFilters: MapFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const emptyTimeFilters: TimeMachineFilterOptions = {
  ...emptyMapFilters,
  presets: [
    { value: "last-7-days", label: "Last 7 days", configurable: false, notice: "Requires day data" },
    { value: "last-30-days", label: "Last 30 days", configurable: false, notice: "Requires day data" },
    { value: "last-6-months", label: "Last 6 months", configurable: false, notice: "" },
    { value: "year-wise", label: "Year-wise view", configurable: false, notice: "" },
    { value: "festival-season", label: "Festival season", configurable: true, notice: "" },
    { value: "weekend-nights", label: "Weekend nights", configurable: false, notice: "Requires time/day data" },
    { value: "rainy-season", label: "Rainy season", configurable: false, notice: "" },
    { value: "election-period", label: "Election period", configurable: true, notice: "" }
  ]
};

const emptyForecastFilters: ForecastFilterOptions = {
  districts: [],
  crimeTypes: [],
  years: [],
  months: [],
  severities: []
};

const emptySocioFilters: SocioEconomicFilterOptions = {
  districts: [],
  years: [],
  months: [],
  crimeTypes: [],
  severities: []
};

const emptyCorrelation: SocioEconomicCorrelation = {
  crime_vs_population_density: [],
  cybercrime_vs_digital_access: [],
  property_crime_vs_urbanization: [],
  theft_vs_migration: [],
  risk_vs_economic_stress: [],
  conviction_gap_vs_literacy: []
};

const emptyPatternSummary: PatternSummary = {
  total_patterns_detected: 0,
  critical_patterns: 0,
  high_confidence_patterns: 0,
  most_affected_district: "No data",
  most_repeated_crime_type: "No data",
  latest_detected_pattern: "No patterns"
};

const emptyPatternCharts: PatternCharts = {
  pattern_count_by_type: [],
  severity_distribution: [],
  districts_with_most_patterns: [],
  crime_types_with_most_patterns: [],
  monthly_pattern_trend: []
};

const emptyPatternFilters: PatternFilterOptions = {
  districts: [],
  policeStations: [],
  crimeTypes: [],
  patternTypes: [],
  severities: ["Critical", "High", "Medium", "Low"],
  years: [],
  months: []
};

const emptyAiFilters: AiInsightFilterOptions = {
  districts: [],
  years: [],
  months: [],
  crimeTypes: [],
  severities: ["Critical", "High", "Medium", "Low"],
  timeRanges: ["Current period", "Last 3 months", "Last 6 months", "Year to date"]
};

export const localCatalystFallback = <T>(path: string): T | null => {
  if (path.includes("/dashboard/global-stats")) return { data: emptyGlobalStats } as T;
  if (path.includes("/dashboard/summary")) return { data: emptyDashboardSummary } as T;
  if (path.includes("/dashboard/filters")) return { data: emptyDashboardFilters } as T;
  if (path.includes("/dashboard/")) return { data: [] } as T;

  if (path.includes("/risk/districts")) return { data: [] } as T;
  if (path.includes("/risk/")) return { data: null } as T;

  if (path.includes("/alerts/summary")) return { data: emptyAlertSummary } as T;
  if (path.includes("/alerts/charts")) return { data: emptyAlertCharts } as T;
  if (path.includes("/alerts/filters")) return { data: emptyAlertFilters } as T;
  if (path.includes("/alerts/")) return { data: [] } as T;

  if (path.includes("/map/summary")) return { data: emptyMapSummary } as T;
  if (path.includes("/map/filters")) return { data: emptyMapFilters } as T;
  if (path.includes("/map/")) return { data: [] } as T;

  if (path.includes("/time-machine/filters")) return { data: emptyTimeFilters } as T;
  if (path.includes("/time-machine/timeline")) return { data: { timeline: [] } } as T;
  if (path.includes("/time-machine/compare")) {
    return {
      data: {
        selected_period: "No data",
        previous_period: "No data",
        selected_total: 0,
        previous_total: 0,
        percentage_change: 0,
        top_increasing_districts: [],
        top_decreasing_districts: [],
        top_increasing_crime_types: [],
        top_decreasing_crime_types: [],
        severity_change: []
      }
    } as T;
  }
  if (path.includes("/time-machine/movement")) return { data: { movement_patterns: [] } } as T;
  if (path.includes("/time-machine/insights")) return { data: { insights: [] } } as T;

  if (path.includes("/forecast/filters")) return { data: emptyForecastFilters } as T;
  if (path.includes("/forecast/summary")) return { data: null } as T;
  if (path.includes("/forecast/")) return { data: path.includes("next-7-days") || path.includes("districts") ? [] : null } as T;

  if (path.includes("/socio-economic/filters")) return { data: emptySocioFilters } as T;
  if (path.includes("/socio-economic/correlation")) return { data: emptyCorrelation } as T;
  if (path.includes("/socio-economic/insights")) {
    return {
      data: {
        overview: {
          districts_analyzed: 0,
          highest_crime_density_district: "No data",
          highest_cybercrime_risk_district: "No data",
          highest_property_crime_risk_district: "No data",
          strongest_socio_economic_correlation: "No data",
          data_completeness_score: 0,
          uses_starter_profiles: false
        },
        insights: []
      }
    } as T;
  }
  if (path.includes("/socio-economic/district/")) return { data: null } as T;
  if (path.includes("/socio-economic/")) return { data: [] } as T;

  if (path.includes("/patterns/summary")) return { data: emptyPatternSummary } as T;
  if (path.includes("/patterns/charts")) return { data: emptyPatternCharts } as T;
  if (path.includes("/patterns/filters")) return { data: emptyPatternFilters } as T;
  if (path.includes("/patterns/by-type")) return { data: {} } as T;
  if (path.includes("/patterns/detail/")) return { data: null } as T;
  if (path.includes("/patterns/")) return { data: [] } as T;

  if (path.includes("/reports/generate")) return { data: null, message: "No crime data available. Upload CSV records first to generate intelligence reports." } as T;
  if (path.includes("/reports/recent")) return { data: [] } as T;
  if (path.includes("/reports/")) return { data: null } as T;

  if (path.includes("/ai/filters")) return { data: emptyAiFilters } as T;
  if (path.includes("/ai/history")) return { data: [] } as T;
  if (path.includes("/ai/")) return { data: null, message: "No crime data available. Upload CSV records first to generate AI insights." } as T;

  return null;
};

export const readJsonOrLocalFallback = async <T>(response: Response, path: string): Promise<T> => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const fallback = localCatalystFallback<T>(path);
    if (fallback !== null) return fallback;
    throw new Error("Catalyst Functions are not mounted in this local preview. Use catalyst serve for live data.");
  }
  return response.json();
};
