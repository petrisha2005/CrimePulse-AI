import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrimeRecordFilterOptions } from "../types/crime";
import { crimeService } from "../services/crimeService";

const emptyOptions: CrimeRecordFilterOptions = {
  fir_year: [], fir_month: [], district: [], police_station: [], crime_type: [], crime_subtype: [], severity: [], fir_stage: [], complaint_mode: [], beat_name: [], village_area_name: [],
  years: [], months: [], districts: [], policeStations: [], crimeTypes: [], crimeSubtypes: [], severities: [], statuses: [], firStages: [], complaintModes: [], beats: [], villages: []
};

export type CrimeFilterScope = {
  selectedDistrict?: string;
  selectedCrimeType?: string;
  userRole?: string;
  assignedDistrict?: string;
  assignedPoliceStation?: string;
  enabled?: boolean;
};

const activeValue = (value?: string) => Boolean(value && value.trim() && value.toLowerCase() !== "all");

export const useCrimeFilters = ({ selectedDistrict, selectedCrimeType, userRole, assignedDistrict, assignedPoliceStation, enabled = true }: CrimeFilterScope) => {
  const lockedDistrict = userRole === "district_officer" || userRole === "station_officer" ? assignedDistrict : undefined;
  const lockedStation = userRole === "station_officer" ? assignedPoliceStation : undefined;
  const effectiveDistrict = activeValue(lockedDistrict) ? lockedDistrict : activeValue(selectedDistrict) ? selectedDistrict : undefined;
  const effectiveCrimeType = activeValue(selectedCrimeType) ? selectedCrimeType : undefined;
  const [options, setOptions] = useState<CrimeRecordFilterOptions>(emptyOptions);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) { setOptions(emptyOptions); setLoading(false); return; }
    try {
      setLoading(true);
      setError("");
      const response = await crimeService.getCrimeRecordFilters({ district: effectiveDistrict, police_station: lockedStation, crime_type: effectiveCrimeType });
      const next = { ...emptyOptions, ...response.data };
      if (activeValue(lockedDistrict)) next.district = [lockedDistrict!], next.districts = [lockedDistrict!];
      if (activeValue(lockedStation)) next.police_station = [lockedStation!], next.policeStations = [lockedStation!];
      setOptions(next);
    } catch (cause) {
      setOptions(emptyOptions);
      setError(cause instanceof Error ? cause.message : "Unable to load filter options.");
    } finally {
      setLoading(false);
    }
  }, [effectiveCrimeType, effectiveDistrict, enabled, lockedDistrict, lockedStation]);

  useEffect(() => { void refresh(); }, [refresh]);

  return useMemo(() => ({ options, loading, error, refresh, hasOptions: options.districts.length > 0 || options.policeStations.length > 0 || options.crimeTypes.length > 0, lockedDistrict, lockedStation }), [error, loading, lockedDistrict, lockedStation, options, refresh]);
};
