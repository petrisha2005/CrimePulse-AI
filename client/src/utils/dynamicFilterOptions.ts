import type { AiInsightFilterOptions, AlertFilterOptions, CrimeRecordFilterOptions, DashboardFilterOptions, ForecastFilterOptions, MapFilterOptions, PatternFilterOptions, SocioEconomicFilterOptions, TimeMachineFilterOptions } from "../types/crime";

export const toDashboardFilterOptions = (source: CrimeRecordFilterOptions): DashboardFilterOptions => ({
  years: source.years, months: source.months, districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses
});

export const toAlertFilterOptions = (source: CrimeRecordFilterOptions): AlertFilterOptions => ({
  districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses, alertTypes: [], years: source.years, months: source.months,
  district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage, alert_type: [], fir_year: source.fir_year, fir_month: source.fir_month
});

export const toMapFilterOptions = (source: CrimeRecordFilterOptions): MapFilterOptions => ({ years: source.years, months: source.months, districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses, fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage });

export const toForecastFilterOptions = (source: CrimeRecordFilterOptions): ForecastFilterOptions => ({ districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, years: source.years, months: source.months, severities: source.severities, statuses: source.statuses, fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage });

export const toPatternFilterOptions = (source: CrimeRecordFilterOptions): PatternFilterOptions => ({ districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, patternTypes: [], severities: source.severities, statuses: source.statuses, years: source.years, months: source.months, fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage });

export const toSocioEconomicFilterOptions = (source: CrimeRecordFilterOptions): SocioEconomicFilterOptions => ({ districts: source.districts, policeStations: source.policeStations, years: source.years, months: source.months, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses, fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage });

export const toAiInsightFilterOptions = (source: CrimeRecordFilterOptions): AiInsightFilterOptions => ({ years: source.years, months: source.months, districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses, fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, fir_stage: source.fir_stage, timeRanges: [] });

export const toTimeMachineFilterOptions = (source: CrimeRecordFilterOptions): TimeMachineFilterOptions => ({ years: source.years, months: source.months, districts: source.districts, policeStations: source.policeStations, crimeTypes: source.crimeTypes, severities: source.severities, statuses: source.statuses, presets: [], fir_year: source.fir_year, fir_month: source.fir_month, district: source.district, police_station: source.police_station, crime_type: source.crime_type, severity: source.severity, fir_stage: source.fir_stage });
