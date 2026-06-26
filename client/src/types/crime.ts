export type Severity = "Low" | "Medium" | "High" | "Critical";

export interface CrimeRecord {
  ROWID?: string;
  crime_id: string;
  district: string;
  police_station: string;
  crime_type: string;
  crime_subtype: string;
  severity: Severity;
  severity_original: string;
  fir_year: number;
  fir_month: number;
  fir_day: number;
  crime_date: string;
  latitude_value?: number | null;
  longitude_value?: number | null;
  offence_location: string;
  beat_name: string;
  village_area_name: string;
  fir_stage: string;
  complaint_mode: string;
  act_section: string;
  victim_count: number;
  accused_count: number;
  arrested_count: number;
  conviction_count: number;
  unit_id: string;
  created_time: string;
  dataset_id?: string;
  dataset_name?: string;
  upload_id?: string;
  source_file_name?: string;
  imported_at?: string;
}

export interface DashboardSummary {
  totalCrimes: number;
  totalDistricts: number;
  totalPoliceStations: number;
  mostReportedCrimeType: string;
  heinousCrimeCount: number;
  nonHeinousCrimeCount: number;
  highSeverityCrimes: number;
  totalVictims: number;
  totalAccused: number;
  totalArrests: number;
  totalConvictions: number;
  coordinateAvailablePercentage: number;
  fetchedRecords?: number;
  filtersApplied?: boolean;
}

export interface ChartDatum {
  name: string;
  value: number;
}

export interface MonthlyTrend {
  month: string;
  crimes: number;
}

export interface YearlyTrend {
  year: string;
  crimes: number;
}

export interface DashboardFilters {
  year?: string;
  month?: string;
  fir_year?: string;
  fir_month?: string;
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  status?: string;
  fir_stage?: string;
  crime_group?: string;
  crime_subtype?: string;
  fir_type?: string;
  complaint_mode?: string;
}

export interface DashboardResponseMeta {
  totalUploadedRecords: number;
  recordsAnalyzed: number;
  analysisScope: "full_dataset" | "filtered_dataset" | string;
  isFiltered: boolean;
  isSampled: boolean;
  isCached?: boolean;
  cacheGeneratedAt?: string;
  cacheVersion?: string;
  durationMs?: number;
  appliedFilters: Record<string, string>;
}

export interface DashboardFilterOptions {
  years: string[];
  months: string[];
  districts: string[];
  policeStations: string[];
  crimeTypes: string[];
  severities: string[];
  statuses: string[];
}

export interface GlobalStats {
  total_records: number;
  total_uploaded_records?: number;
  records_analyzed?: number;
  analysis_scope?: string;
  is_sampled?: boolean;
  is_cached?: boolean;
  cache_generated_at?: string;
  duration_ms?: number;
  total_districts: number;
  total_police_stations: number;
  year_range: string;
  total_crime_groups: number;
  records_with_coordinates: number;
  records_without_coordinates: number;
  coordinate_available_percentage: number;
  data_quality_score: number;
  last_updated: string;
  fetched_records?: number;
  filters_applied?: boolean;
  partial?: boolean;
  message?: string;
}

export interface DistrictAnalyticsSummary {
  total_districts: number;
  total_records: number;
  highest_crime_district: string;
  lowest_crime_district: string;
  average_crimes_per_district: number;
  highest_risk_district: string;
  most_common_crime_type: string;
  district_coverage_quality: number;
}

export interface DistrictAnalyticsRanking {
  rank: number;
  district: string;
  total_crimes: number;
  crime_share_percentage: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  top_crime_type: string;
  top_police_station: string;
  heinous_count: number;
  non_heinous_count: number;
  victim_count: number;
  accused_count: number;
  arrested_count: number;
  conviction_count: number;
  coordinate_available_percentage: number;
}

export interface DistrictAnalyticsProfile {
  district: string;
  total_crimes: number;
  crime_share_percentage: number;
  total_police_stations: number;
  top_police_station: string;
  top_crime_type: string;
  top_crime_subtype: string;
  heinous_count: number;
  non_heinous_count: number;
  victim_count: number;
  accused_count: number;
  arrested_count: number;
  conviction_count: number;
  arrest_rate: number;
  conviction_rate: number;
  coordinate_available_percentage: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  operational_summary: string;
  key_observations: string[];
  recommended_actions: string[];
}

export interface DistrictTrendItem {
  period: string;
  year: string;
  month: string;
  total_crimes: number;
  heinous_count: number;
  top_crime_type: string;
}

export interface DistrictCrimeTypeItem extends ChartDatum {
  crime_type: string;
  count: number;
  percentage: number;
  top_crime_subtype: string;
}

export interface DistrictPoliceStationItem extends ChartDatum {
  police_station: string;
  count: number;
  percentage: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  top_crime_type: string;
}

export interface DistrictCrimeTwin {
  crime_personality_summary: string;
  main_risk_pattern: string;
  operational_priority: string;
  prevention_strategy: string;
}

export interface DistrictRiskDna {
  district: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  confidence_score: number;
  dominant_crime_type: string;
  dominant_crime_head: string;
  total_crimes: number;
  heinous_crimes: number;
  non_heinous_crimes: number;
  peak_month: string;
  top_police_station: string;
  trend_direction: "Increasing" | "Stable" | "Decreasing";
  why_this_risk: string[];
  top_crime_groups: ChartDatum[];
  top_crime_heads: ChartDatum[];
  monthly_trend: MonthlyTrend[];
  fir_stage_distribution: ChartDatum[];
  complaint_mode_distribution: ChartDatum[];
  victim_count: number;
  accused_count: number;
  arrested_count: number;
  conviction_count: number;
  arrest_rate: number;
  conviction_rate: number;
  coordinate_available_percentage: number;
  recommendations: string[];
  police_station_ranking: ChartDatum[];
  district_crime_twin: DistrictCrimeTwin;
}

export interface DistrictRiskListItem {
  district: string;
  total_crimes: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
}

export interface RiskIntelligenceSummary {
  total_records_analyzed: number;
  total_districts: number;
  total_police_stations: number;
  critical_zones: number;
  high_risk_zones: number;
  highest_risk_district: string;
  highest_risk_police_station: string;
  highest_risk_crime_type: string;
  average_risk_score: number;
  generated_at: string;
}

export interface RiskDistrictRanking {
  district: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  total_crimes: number;
  heinous_count: number;
  heinous_share: number;
  top_crime_type: string;
  top_police_station: string;
  trend_direction: string;
  conviction_gap_score: number;
  pending_stage_share: number;
  coordinate_available_percentage: number;
  explanation: string;
  recommended_action: string;
}

export interface RiskPoliceStationRanking {
  district: string;
  police_station: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  total_crimes: number;
  top_crime_type: string;
  heinous_count: number;
  crime_share_in_district: number;
  trend_direction: string;
  explanation: string;
  recommended_action: string;
}

export interface RiskCrimeTypeRanking {
  crime_type: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  total_crimes: number;
  affected_districts: number;
  top_district: string;
  top_police_station: string;
  heinous_share: number;
  trend_direction: string;
  explanation: string;
  recommended_action: string;
}

export interface RiskPriorityZone {
  zone_id: string;
  district: string;
  police_station: string;
  crime_type: string;
  priority_level: "Low" | "Medium" | "High" | "Critical";
  risk_score: number;
  reason: string;
  immediate_action: string;
  resource_suggestion: string;
}

export interface RiskFactor {
  factor_name: string;
  score: number;
  weight: number;
  level: "Low" | "Medium" | "High" | "Critical";
  explanation: string;
}

export interface RiskInterventionPlan {
  priority: string;
  title: string;
  district: string;
  police_station: string;
  crime_type: string;
  action: string;
  reason: string;
  expected_impact: string;
  timeline: string;
}

export interface RedZoneAlert {
  alert_id: string;
  alert_type: string;
  title: string;
  district: string;
  police_station: string;
  crime_type: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  increase_percentage: number;
  current_value: number;
  expected_value: number;
  time_period: string;
  explanation: string;
  recommended_action: string;
  detected_at: string;
}

export interface AlertSummary {
  totalActiveAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  highRiskDistricts: number;
  districtsWithAlerts: number;
  mostCommonAlertType: string;
  latestAlertTime: string;
  totalRecordsAnalyzed?: number;
  total_active_alerts?: number;
  critical_alerts?: number;
  high_alerts?: number;
  medium_alerts?: number;
  high_risk_districts?: number;
  districts_with_alerts?: number;
  most_common_alert_type?: string;
  latest_alert_time?: string;
  total_records_analyzed?: number;
}

export interface AlertFilters {
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  alert_type?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  status?: string;
}

export interface AlertFilterOptions {
  districts: string[];
  policeStations?: string[];
  crimeTypes: string[];
  severities: string[];
  statuses?: string[];
  alertTypes: string[];
  years: string[];
  months: string[];
  district?: string[];
  police_station?: string[];
  crime_type?: string[];
  severity?: string[];
  fir_stage?: string[];
  alert_type?: string[];
  fir_year?: string[];
  fir_month?: string[];
}

export interface AlertCharts {
  spikeComparison: Array<{ name: string; current: number; expected: number }>;
  districtAnomalyCounts: ChartDatum[];
  severityDistribution: ChartDatum[];
  monthlyAnomalyTrend: ChartDatum[];
  alertsByCrimeType?: ChartDatum[];
}

export interface TimeRiskAlert {
  alert_id: string;
  crimeType: string;
  crime_type?: string;
  district: string;
  policeStation: string;
  police_station?: string;
  riskWindow: string | null;
  risk_window?: string | null;
  riskPeriod: string | null;
  risk_period?: string | null;
  hasExactTime: boolean;
  has_exact_time?: boolean;
  timeSourceField?: string;
  time_source_field?: string;
  evidenceCount: number;
  evidence_count?: number;
  confidence: "Low" | "Medium" | "High";
  message: string;
  suggestedAction: string;
  suggested_action?: string;
}

export interface TimeRiskResponse {
  has_exact_time_data: boolean;
  exact_time_field: string;
  message: string;
  alerts: TimeRiskAlert[];
}

export interface MapFilters {
  year?: string;
  month?: string;
  fir_year?: string;
  fir_month?: string;
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  status?: string;
  fir_stage?: string;
  limit?: string;
}

export interface CrimeMapPoint {
  id?: string;
  crime_id: string;
  district: string;
  police_station: string;
  crime_type: string;
  crime_subtype?: string;
  severity: Severity;
  fir_year?: string | number;
  fir_month?: string | number;
  fir_day?: string | number;
  crime_date?: string;
  date: string;
  latitude: number;
  longitude: number;
  coordinate_source?: "original" | "district_fallback" | "karnataka_fallback";
  intensity?: number;
  location: string;
  status: string;
  popup?: {
    title: string;
    district: string;
    police_station: string;
    crime_type: string;
    crime_subtype?: string;
    severity: Severity;
    date: string;
    fir_stage: string;
  };
}

export interface CrimeHotspot {
  hotspot_id: string;
  district: string;
  police_station: string;
  latitude?: number;
  longitude?: number;
  center_latitude: number;
  center_longitude: number;
  crime_count: number;
  top_crime_type?: string;
  dominant_crime_type: string;
  heinous_count?: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  risk_score: number;
  intensity_score?: number;
  coordinate_source?: "original" | "district_fallback" | "karnataka_fallback";
  recommended_action: string;
}

export interface DistrictIntensity {
  district: string;
  latitude: number;
  longitude: number;
  crime_count: number;
  police_station_count?: number;
  top_crime_type?: string;
  heinous_count: number;
  dominant_crime_type: string;
  intensity_score?: number;
  risk_level?: "Low" | "Medium" | "High" | "Critical";
  intensity_level: "Low" | "Medium" | "High" | "Critical";
}

export interface MapSummary {
  total_records: number;
  records_with_coordinates: number;
  records_without_coordinates: number;
  records_using_fallback_coordinates?: number;
  coordinate_available_percentage?: number;
  total_districts?: number;
  total_police_stations?: number;
  hotspot_count?: number;
  active_hotspots: number;
  highest_intensity_district?: string;
  highest_risk_district: string;
  highest_intensity_police_station?: string;
  most_common_mapped_crime_type: string;
  fallback_used?: boolean;
}

export interface MapFilterOptions {
  years: string[];
  months: string[];
  districts: string[];
  policeStations: string[];
  crimeTypes: string[];
  severities: string[];
  statuses: string[];
  fir_year?: string[];
  fir_month?: string[];
  district?: string[];
  police_station?: string[];
  crime_type?: string[];
  severity?: string[];
  fir_stage?: string[];
}

export interface TimeMachineFilters {
  period?: string;
  start_year?: string;
  start_month?: string;
  end_year?: string;
  end_month?: string;
  from_year?: string;
  from_month?: string;
  to_year?: string;
  to_month?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  status?: string;
  preset?: string;
}

export interface TimeMachineTimelineItem {
  period: string;
  year?: string;
  month?: string;
  total_crimes: number;
  heinous_count: number;
  non_heinous_count?: number;
  top_district: string;
  top_crime_type: string;
  victim_count?: number;
  accused_count?: number;
  arrest_count?: number;
  conviction_count?: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
}

export interface TimeMachineChangeItem {
  name: string;
  value: number;
  previous: number;
  change: number;
}

export interface TimeMachineCompare {
  from_period?: string;
  to_period?: string;
  from_total?: number;
  to_total?: number;
  difference?: number;
  trend?: "Rising" | "Falling" | "Increased" | "Reduced" | "Stable";
  changed_crime_types?: TimeMachineChangeItem[];
  changed_districts?: TimeMachineChangeItem[];
  insight?: string;
  selected_period: string;
  previous_period: string;
  selected_total: number;
  previous_total: number;
  percentage_change: number;
  explanation?: string;
  top_increasing_districts: TimeMachineChangeItem[];
  top_decreasing_districts: TimeMachineChangeItem[];
  top_increasing_crime_types: TimeMachineChangeItem[];
  top_decreasing_crime_types: TimeMachineChangeItem[];
  severity_change: TimeMachineChangeItem[];
}

export interface MovementPattern {
  pattern_type: string;
  from_area: string;
  to_area: string;
  crime_type: string;
  change_percentage: number;
  explanation: string;
}

export interface TimeMachineSummary {
  total_records: number;
  year_range: string;
  month_range: string;
  earliest_record: string;
  latest_record: string;
  earliest_period?: string;
  latest_period?: string;
  peak_period?: string;
  peak_period_crimes?: number;
  peak_year: string;
  peak_month: string;
  fastest_growing_crime_type: string;
  fastest_rising_crime_type?: string;
  fastest_falling_crime_type?: string;
  most_active_district?: string;
  percentage_change?: number;
  time_machine_summary?: string;
  trend_direction: "Rising" | "Falling" | "Increasing" | "Decreasing" | "Stable";
  total_periods_available: number;
}

export interface TimeMachineYearlyItem {
  year: string;
  total_crimes: number;
  heinous_count: number;
  non_heinous_count: number;
  top_crime_type: string;
  top_district: string;
  victim_count: number;
  accused_count: number;
  arrest_count: number;
  conviction_count: number;
}

export interface TimeMachineMonthlyItem {
  month: string;
  month_name?: string;
  total_crimes: number;
  average_per_year: number;
  top_crime_type: string;
  seasonal_risk_level: "Low" | "Medium" | "High" | "Critical";
  risk_level?: "Low" | "Medium" | "High" | "Critical";
}

export interface TimeMachineInsight {
  title: string;
  description: string;
  severity: string;
  related_district: string;
  related_crime_type: string;
  suggested_action: string;
}

export interface TimeMachinePeriodDetails {
  period: string;
  previous_period: string;
  total_crimes: number;
  previous_total: number;
  percentage_change: number;
  trend_direction: "Increasing" | "Decreasing" | "Stable";
  top_crime_type: string;
  top_district: string;
  heinous_count: number;
  top_crime_types: ChartDatum[];
  districts: ChartDatum[];
  police_stations: ChartDatum[];
  severity_distribution: ChartDatum[];
  coordinate_mode: string;
  insight: string;
}

export interface TimePresetOption {
  value: string;
  label: string;
  configurable: boolean;
  notice: string;
}

export interface TimeMachineFilterOptions extends MapFilterOptions {
  presets: TimePresetOption[];
}

export interface ForecastFilters {
  district?: string;
  police_station?: string;
  crime_type?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  severity?: string;
  fir_stage?: string;
  status?: string;
}

export interface CrimeForecast {
  forecast_id: string;
  district: string;
  forecast_date: string;
  forecast_label: string;
  date_label?: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  confidence_score: number;
  predicted_crime_volume?: number;
  predicted_volume?: number;
  expected_crime_types: string[];
  expected_concern: string;
  peak_risk_period: string;
  top_police_station?: string;
  main_reason: string;
  explanation?: string;
  why_this_forecast: string[];
  recommended_action: string;
  recommended_actions?: string[];
  trend_direction: "Increasing" | "Stable" | "Decreasing";
  expected_crime_count: number;
  high_severity_probability: number;
  day?: number;
  top_risk_district?: string;
  top_risk_crime_type?: string;
  recommendation?: string;
}

export interface ForecastSummary {
  total_records_analyzed?: number;
  highest_risk_crime_type?: string;
  overall_risk_level?: "Low" | "Medium" | "High" | "Critical";
  forecast_window?: string;
  generated_at?: string;
  model_type?: string;
  today_overall_risk: "Low" | "Medium" | "High" | "Critical";
  highest_risk_district: string;
  expected_concern: string;
  forecast_confidence: number;
  last_updated_time: string;
  risk_distribution: ChartDatum[];
}

export interface ForecastFilterOptions {
  districts: string[];
  policeStations?: string[];
  crimeTypes: string[];
  years: string[];
  months: string[];
  severities: string[];
  statuses?: string[];
  fir_year?: string[];
  fir_month?: string[];
  district?: string[];
  police_station?: string[];
  crime_type?: string[];
  severity?: string[];
  fir_stage?: string[];
}

export interface CrimeTypeForecast {
  forecast_id?: string;
  crime_type: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  predicted_volume: number;
  predicted_crime_volume?: number;
  affected_districts: string[];
  peak_month: string;
  confidence_score: number;
  recommended_action: string;
  name?: string;
  value?: number;
}

export interface ForecastRiskCalendarItem {
  month: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  predicted_volume: number;
  top_crime_type: string;
  top_district: string;
}

export interface ForecastRecommendation {
  priority: string;
  title: string;
  district: string;
  crime_type: string;
  action: string;
  reason: string;
  confidence_score: number;
}

export interface SocioEconomicProfile {
  district: string;
  population_density: number;
  literacy_rate: number;
  urbanization_rate: number;
  migration_level: number;
  unemployment_rate: number;
  digital_access_score: number;
  economic_stress_score: number;
  youth_population_percentage: number;
  updated_at: string;
  is_starter_estimate?: boolean;
}

export interface SocioEconomicComparisonRow extends SocioEconomicProfile {
  total_crimes: number;
  total_victims?: number;
  total_accused?: number;
  total_arrests?: number;
  total_convictions?: number;
  dominant_crime_type: string;
  cybercrime_count: number;
  property_crime_count: number;
  theft_count: number;
  heinous_count: number;
  heinous_share?: number;
  conviction_rate: number;
  arrest_rate: number;
  pending_case_share?: number;
  complaint_mode_dominance?: string;
  coordinate_available_percentage?: number;
  public_safety_pressure_score?: number;
  vulnerability_pressure_score?: number;
  legal_resolution_gap_score?: number;
  administrative_load_score?: number;
  spatial_data_readiness_score?: number;
  community_safety_risk_score?: number;
  vulnerability_index?: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  main_insight: string;
  prevention_strategies: string[];
}

export interface SocioEconomicOverview {
  total_records_analyzed?: number;
  total_districts?: number;
  highest_vulnerability_district?: string;
  highest_public_safety_pressure_district?: string;
  highest_resolution_gap_district?: string;
  average_vulnerability_index?: number;
  data_note?: string;
  districts_analyzed: number;
  highest_crime_density_district: string;
  highest_cybercrime_risk_district: string;
  highest_property_crime_risk_district: string;
  strongest_socio_economic_correlation: string;
  data_completeness_score: number;
  uses_starter_profiles: boolean;
}

export interface SocioEconomicInsight {
  title: string;
  insight_type?: string;
  district?: string;
  description: string;
  evidence?: string[];
  impact?: string;
  recommendation?: string;
  severity: string;
  recommended_actions: string[];
}

export interface SocioEconomicCorrelationPoint {
  factor: string;
  related_to: string;
  relationship_strength: string;
  explanation: string;
}

export interface SocioEconomicCorrelation {
  crime_vs_population_density: Array<{ x: number; y: number; name: string }>;
  cybercrime_vs_digital_access: Array<{ x: number; y: number; name: string }>;
  property_crime_vs_urbanization: Array<{ x: number; y: number; name: string }>;
  theft_vs_migration: Array<{ x: number; y: number; name: string }>;
  risk_vs_economic_stress: Array<{ x: number; y: number; name: string }>;
  conviction_gap_vs_literacy: Array<{ x: number; y: number; name: string }>;
}

export interface SocioEconomicFilters {
  district?: string;
  police_station?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  status?: string;
}

export interface SocioEconomicFilterOptions {
  districts: string[];
  policeStations?: string[];
  years: string[];
  months: string[];
  crimeTypes: string[];
  severities: string[];
  statuses?: string[];
  fir_year?: string[];
  fir_month?: string[];
  district?: string[];
  police_station?: string[];
  crime_type?: string[];
  severity?: string[];
  fir_stage?: string[];
}

export interface SocioEconomicRiskIndicator {
  score: number;
  level: "Low" | "Medium" | "High" | "Critical";
  explanation: string;
  affected_districts: string[];
}

export interface SocioEconomicRiskIndicators {
  public_safety_pressure: SocioEconomicRiskIndicator;
  vulnerability_pressure: SocioEconomicRiskIndicator;
  legal_resolution_gap: SocioEconomicRiskIndicator;
  administrative_load: SocioEconomicRiskIndicator;
  spatial_data_readiness: SocioEconomicRiskIndicator;
  community_safety_risk: SocioEconomicRiskIndicator;
}

export interface SocioEconomicVulnerabilityItem {
  district: string;
  vulnerability_index: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  main_driver: string;
  supporting_metrics: Record<string, number | string>;
}

export interface SocioEconomicRecommendation {
  priority: string;
  title: string;
  district: string;
  action: string;
  reason: string;
  expected_impact: string;
}

export interface CrimePattern {
  pattern_id: string;
  pattern_type: string;
  title: string;
  district: string;
  police_station: string;
  crime_type: string;
  crime_subtype?: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  confidence_score: number;
  time_period: string;
  explanation: string;
  evidence: string[];
  suggested_action: string;
  detected_at: string;
}

export interface PatternSummary {
  total_patterns_detected: number;
  critical_patterns: number;
  high_confidence_patterns: number;
  most_affected_district: string;
  most_repeated_crime_type: string;
  latest_detected_pattern: string;
}

export interface PatternCharts {
  pattern_count_by_type: ChartDatum[];
  severity_distribution: ChartDatum[];
  districts_with_most_patterns: ChartDatum[];
  crime_types_with_most_patterns: ChartDatum[];
  monthly_pattern_trend: ChartDatum[];
}

export interface PatternFilters {
  district?: string;
  police_station?: string;
  crime_type?: string;
  pattern_type?: string;
  severity?: string;
  fir_stage?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  status?: string;
  confidence_min?: string;
}

export interface PatternFilterOptions {
  districts: string[];
  policeStations: string[];
  crimeTypes: string[];
  patternTypes: string[];
  severities: string[];
  statuses?: string[];
  years: string[];
  months: string[];
  district?: string[];
  police_station?: string[];
  crime_type?: string[];
  pattern_type?: string[];
  severity?: string[];
  fir_stage?: string[];
  fir_year?: string[];
  fir_month?: string[];
}

export interface ReportFilters {
  district?: string;
  police_station?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  status?: string;
}

export interface ReportRequest {
  report_type: "executive-summary" | "full-intelligence-report" | "district-report" | "red-zone-alerts-report" | "hotspot-map-report" | "crime-trend-forecast-report" | "fir-stage-case-progress-report" | string;
  report_title?: string;
  filters: ReportFilters;
  sections: string[];
}

export interface ReportPreview {
  report_id: string;
  report_title: string;
  report_type: string;
  generated_at: string;
  filters: ReportFilters;
  executive_summary: string;
  key_findings: string[];
  charts_summary: {
    district_ranking: ChartDatum[];
    crime_type_distribution: ChartDatum[];
    monthly_trend: Array<{ period: string; crimes: number }>;
  };
  risk_districts: ChartDatum[];
  anomalies: string[];
  forecast: string;
  recommendations: string[];
  ai_note: string;
}

export interface GeneratedReportResponse {
  report_id: string;
  report_type: string;
  title: string;
  report_title?: string;
  generated_at: string;
  records_analyzed: number;
  sections: Array<{ title: string; body: string }>;
  html: string;
  markdown: string;
  key_findings: string[];
  recommendations: string[];
  preview?: ReportPreview;
  download_url?: string;
  ai_mode?: string;
  meta?: {
    totalUploadedRecords?: number;
    recordsAnalyzed?: number;
    reportType?: string;
    reportTypeLabel?: string;
    appliedFilters?: ReportFilters | Record<string, string>;
    generatedAt?: string;
    coordinateCoverage?: number;
    dataQuality?: number;
    isGeminiUsed?: boolean;
    isFallbackUsed?: boolean;
  };
}

export interface RecentReport {
  report_id: string;
  report_title: string;
  report_type: string;
  district: string;
  generated_at: string;
  pdf_file_id_or_path: string;
}

export interface AiInsightFilters {
  district?: string;
  police_station?: string;
  fir_year?: string;
  fir_month?: string;
  year?: string;
  month?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  status?: string;
  time_range?: string;
}

export interface AiSummary {
  total_records: number;
  total_crimes?: number;
  districts_covered: number;
  police_stations_covered: number;
  dominant_crime_type: string;
  highest_risk_district: string;
  highest_risk_crime_type: string;
  strongest_pattern: string;
  main_operational_gap: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  heinous_count: number;
  non_heinous_count: number;
  total_victims: number;
  total_accused: number;
  total_arrests: number;
  total_convictions: number;
  arrest_rate: number;
  conviction_rate: number;
  coordinate_available_percentage: number;
  ai_mode: "Gemini" | "Rule-based" | "Rule-based fallback" | string;
  records_analyzed: number;
}

export interface AiGeneratedInsight {
  insight_id: string;
  type: string;
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical" | string;
  explanation: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
}

export interface AiRecommendation {
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical" | string;
  action: string;
  reason: string;
}

export interface AiAskResponse {
  question: string;
  answer: string;
  records_analyzed: number;
  ai_mode: "Gemini" | "Rule-based" | "Rule-based fallback" | string;
}

export interface AiAnalyticsSummary {
  district: string;
  total_crimes: number;
  dominant_crime_type: string;
  district_ranking: ChartDatum[];
  top_police_stations: ChartDatum[];
  police_station_concentration: number;
  heinous_crime_count: number;
  trend_direction: "Increasing" | "Stable" | "Decreasing";
  arrest_rate: number;
  conviction_rate: number;
  missing_coordinate_percentage: number;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  top_factors: string[];
  data_quality_notes: string[];
  recommendations: string[];
}

export interface AiInsight {
  insight_id: string;
  insight_type: string;
  title: string;
  district: string;
  crime_type: string;
  year: string;
  month: string;
  input_summary: string;
  generated_text: string;
  recommendations: string;
  generated_at: string;
}

export interface AiInsightResult {
  insight: AiInsight;
  analytics_summary: AiAnalyticsSummary;
  generated_text: string;
  recommendations: string[];
  ai_note: string;
}

export interface AiInsightHistoryItem {
  insight_id: string;
  insight_type: string;
  title: string;
  district: string;
  crime_type: string;
  generated_text: string;
  recommendations: string;
  generated_at: string;
}

export interface AiInsightFilterOptions {
  districts: string[];
  policeStations?: string[];
  years: string[];
  months: string[];
  crimeTypes: string[];
  severities: string[];
  statuses?: string[];
  district?: string[];
  police_station?: string[];
  fir_year?: string[];
  fir_month?: string[];
  crime_type?: string[];
  fir_stage?: string[];
  timeRanges: string[];
}

export interface ApiResponse<T> {
  data: T;
  success?: boolean;
  meta?: DashboardResponseMeta;
  pagination?: CrimeRecordsPagination;
  totalRecords?: number;
  source?: "catalyst" | "sample";
  message?: string;
}

export interface CrimeRecordsPagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CrimeRecordQuery {
  page?: number;
  limit?: number;
  search?: string;
  fir_year?: string;
  fir_month?: string;
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  fir_stage?: string;
  year?: string;
  month?: string;
  status?: string;
}

export interface CrimeRecordFilterOptions {
  fir_year: string[];
  fir_month: string[];
  district: string[];
  police_station: string[];
  crime_type: string[];
  severity: string[];
  fir_stage: string[];
  crime_subtype?: string[];
  complaint_mode?: string[];
  beat_name?: string[];
  village_area_name?: string[];
  years: string[];
  months: string[];
  districts: string[];
  policeStations: string[];
  crimeTypes: string[];
  severities: string[];
  statuses: string[];
  crimeSubtypes?: string[];
  firStages?: string[];
  complaintModes?: string[];
  beats?: string[];
  villages?: string[];
}

export interface UploadSummary {
  success: boolean;
  totalRows: number;
  validRows: number;
  insertedRows: number;
  skippedRows: number;
  errorRows: number;
  validationErrors: string[];
  storageVerified: boolean;
  storedRecordCountAfterUpload: number;
  batchErrors?: string[];
  upload_id?: string;
  skippedDuplicates?: number;
  warningRows?: number;
  durationSeconds?: number;
  detectedDistricts?: string[];
  detectedCrimeTypes?: string[];
  detectedYearRange?: string;
  failedRowDetails?: Array<{ row?: number; errors?: string[]; error?: string; raw?: Record<string, string> }>;
}

export interface DetectedCsvMapping {
  mapping: Record<string, string>;
  confidence: Record<string, number>;
  validDataset: boolean;
  missingMinimum: string[];
  unmappedColumns: string[];
}

export interface CsvPreview {
  headers: string[];
  rows: Record<string, string>[];
  missingRequired: string[];
  detectedMapping?: DetectedCsvMapping;
  analysis?: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    detectedDistricts: string[];
    detectedPoliceStations: string[];
    detectedCrimeTypes: string[];
    detectedDateRange: string;
    coordinateAvailablePercentage: number;
  };
}

export interface CrimeCount {
  totalRecords: number;
}

export interface CrimeDataset {
  dataset_id: string;
  dataset_name: string;
  source_file_name: string;
  upload_id: string;
  imported_at: string;
  record_count: number;
  year_range: string;
  district_count: number;
  crime_type_count: number;
}
