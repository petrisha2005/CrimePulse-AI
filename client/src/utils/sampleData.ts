import type { ChartDatum, CrimeRecord, DashboardSummary, MonthlyTrend } from "../types/crime";

export const sampleCrimeRecords: CrimeRecord[] = [
  {
    crime_id: "KA-2026-BLR-0001",
    district: "Bengaluru City",
    police_station: "Indiranagar",
    crime_type: "THEFT",
    crime_subtype: "CHAIN SNATCHING",
    severity: "Medium",
    severity_original: "Non Heinous",
    fir_year: 2026,
    fir_month: 1,
    fir_day: 5,
    crime_date: "2026-01-05",
    latitude_value: 12.9719,
    longitude_value: 77.6412,
    offence_location: "Near metro station",
    beat_name: "Beat 12",
    village_area_name: "Indiranagar",
    fir_stage: "Registered",
    complaint_mode: "Written",
    act_section: "IPC 379",
    victim_count: 1,
    accused_count: 1,
    arrested_count: 0,
    conviction_count: 0,
    unit_id: "BLR-001",
    created_time: "2026-01-05T00:00:00.000Z"
  },
  {
    crime_id: "KA-2026-MYS-0002",
    district: "Mysuru",
    police_station: "Lashkar",
    crime_type: "ASSAULT",
    crime_subtype: "GRIEVOUS HURT",
    severity: "High",
    severity_original: "Heinous",
    fir_year: 2026,
    fir_month: 1,
    fir_day: 8,
    crime_date: "2026-01-08",
    latitude_value: null,
    longitude_value: null,
    offence_location: "Market road",
    beat_name: "Central Beat",
    village_area_name: "Lashkar Mohalla",
    fir_stage: "Under Investigation",
    complaint_mode: "Online",
    act_section: "IPC 307",
    victim_count: 2,
    accused_count: 3,
    arrested_count: 1,
    conviction_count: 0,
    unit_id: "MYS-004",
    created_time: "2026-01-08T00:00:00.000Z"
  },
  {
    crime_id: "KA-2026-DWR-0003",
    district: "Dharwad",
    police_station: "Hubballi Town",
    crime_type: "CYBER CRIME",
    crime_subtype: "ONLINE FRAUD",
    severity: "Medium",
    severity_original: "Non Heinous",
    fir_year: 2026,
    fir_month: 2,
    fir_day: 12,
    crime_date: "2026-02-12",
    latitude_value: 15.3647,
    longitude_value: 75.124,
    offence_location: "Online",
    beat_name: "Cyber Desk",
    village_area_name: "Hubballi",
    fir_stage: "Charge Sheeted",
    complaint_mode: "Online",
    act_section: "IT Act",
    victim_count: 4,
    accused_count: 2,
    arrested_count: 2,
    conviction_count: 0,
    unit_id: "DWR-011",
    created_time: "2026-02-12T00:00:00.000Z"
  }
];

const countBy = (records: CrimeRecord[], key: keyof CrimeRecord): ChartDatum[] => {
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    const value = String(record[key] || "Unknown");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

export const sampleSummary = (): DashboardSummary => {
  const crimeTypes = countBy(sampleCrimeRecords, "crime_type");
  const isHeinous = (record: CrimeRecord) => record.severity_original.toLowerCase() === "heinous";
  const isNonHeinous = (record: CrimeRecord) => ["non heinous", "non-heinous"].includes(record.severity_original.toLowerCase());
  return {
    totalCrimes: sampleCrimeRecords.length,
    totalDistricts: new Set(sampleCrimeRecords.map((record) => record.district)).size,
    totalPoliceStations: new Set(sampleCrimeRecords.map((record) => record.police_station)).size,
    mostReportedCrimeType: crimeTypes[0]?.name || "No data",
    heinousCrimeCount: sampleCrimeRecords.filter(isHeinous).length,
    nonHeinousCrimeCount: sampleCrimeRecords.filter(isNonHeinous).length,
    highSeverityCrimes: sampleCrimeRecords.filter((record) => record.severity === "High").length,
    totalVictims: sampleCrimeRecords.reduce((sum, record) => sum + record.victim_count, 0),
    totalAccused: sampleCrimeRecords.reduce((sum, record) => sum + record.accused_count, 0),
    totalArrests: sampleCrimeRecords.reduce((sum, record) => sum + record.arrested_count, 0),
    totalConvictions: sampleCrimeRecords.reduce((sum, record) => sum + record.conviction_count, 0),
    coordinateAvailablePercentage: Math.round(
      (sampleCrimeRecords.filter((record) => record.latitude_value !== null && record.longitude_value !== null).length / sampleCrimeRecords.length) * 100
    )
  };
};

export const sampleCrimeTypes = (): ChartDatum[] => countBy(sampleCrimeRecords, "crime_type");
export const sampleDistrictRanking = (): ChartDatum[] => countBy(sampleCrimeRecords, "district");
export const sampleFirStages = (): ChartDatum[] => countBy(sampleCrimeRecords, "fir_stage");

export const sampleMonthlyTrends = (): MonthlyTrend[] => [
  { month: "Jan 2026", crimes: 2 },
  { month: "Feb 2026", crimes: 1 }
];
