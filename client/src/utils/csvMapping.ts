import Papa from "papaparse";
import type { CsvPreview, DetectedCsvMapping } from "../types/crime";

export const canonicalCrimeFields = ["crime_id", "district", "police_station", "crime_type", "crime_subtype", "severity_original", "fir_year", "fir_month", "fir_day", "crime_date", "latitude_value", "longitude_value", "offence_location", "beat_name", "village_area_name", "fir_stage", "complaint_mode", "act_section", "victim_count", "accused_count", "arrested_count", "conviction_count", "unit_id"] as const;
export type CanonicalCrimeField = typeof canonicalCrimeFields[number];

const synonyms: Record<CanonicalCrimeField, string[]> = {
  crime_id: ["crime id", "fir number", "fir no", "case id", "case number"],
  district: ["district name", "district", "district_name", "districtName"],
  police_station: ["unitname", "police station", "police_station", "station", "ps", "policeStation"],
  crime_type: ["crimegroup name", "crime type", "crime_type", "category", "offence type", "offense type", "crimegroup"],
  crime_subtype: ["crimehead name", "crime head", "crime_subtype", "sub type", "subcategory", "offence head", "crimehead"],
  severity_original: ["fir type", "fir_type", "severity", "case type"],
  fir_year: ["fir year", "year", "crime year", "report year"],
  fir_month: ["fir month", "month", "crime month", "report month"],
  fir_day: ["fir day", "day", "crime day", "report day"],
  crime_date: ["crime date", "fir date", "reported date", "date", "incident date"],
  latitude_value: ["latitude", "lat", "y", "geo lat"],
  longitude_value: ["longitude", "lon", "lng", "long", "x", "geo lng"],
  offence_location: ["place of offence", "location", "offence location", "area", "address", "place"],
  beat_name: ["beat name", "beat"],
  village_area_name: ["village area name", "village", "area", "locality", "ward"],
  fir_stage: ["fir stage", "status", "case status", "investigation status", "stage"],
  complaint_mode: ["complaint mode", "mode", "reporting mode"],
  act_section: ["actsection", "act section", "ipc section", "law section", "section"],
  victim_count: ["victim count", "victims", "victim_count", "total victims"],
  accused_count: ["accused count", "accused_count", "accused", "total accused"],
  arrested_count: ["arrested count no", "arrested count", "arrested_count", "arrested"],
  conviction_count: ["conviction count", "conviction_count", "convictions"],
  unit_id: ["unit id", "unit_id", "station id"]
};

export const normalizeCsvHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const score = (column: string, candidate: string) => {
  if (column === candidate) return 1;
  if (column.includes(candidate) || candidate.includes(column)) return Math.min(column.length, candidate.length) / Math.max(column.length, candidate.length);
  const columnTokens = new Set(column.match(/[a-z]+|\d+/g) || []);
  const candidateTokens = new Set(candidate.match(/[a-z]+|\d+/g) || []);
  const overlap = [...columnTokens].filter((token) => candidateTokens.has(token)).length;
  return overlap ? overlap / Math.max(columnTokens.size, candidateTokens.size) : 0;
};

export const detectCsvMapping = (headers: string[]): DetectedCsvMapping => {
  const used = new Set<string>();
  const mapping = {} as Record<CanonicalCrimeField, string>;
  const confidence = {} as Record<CanonicalCrimeField, number>;
  canonicalCrimeFields.forEach((field) => {
    const candidates = [field, ...synonyms[field]].map(normalizeCsvHeader);
    const best = headers.filter((header) => !used.has(header)).map((header) => ({ header, value: Math.max(...candidates.map((candidate) => score(normalizeCsvHeader(header), candidate))) })).sort((a, b) => b.value - a.value)[0];
    if (best && best.value >= 0.62) {
      mapping[field] = best.header;
      confidence[field] = Math.round(best.value * 100);
      used.add(best.header);
    } else {
      mapping[field] = "";
      confidence[field] = 0;
    }
  });
  const hasIdentity = Boolean(mapping.district || mapping.police_station);
  const hasCrime = Boolean(mapping.crime_type || mapping.crime_subtype);
  const hasTime = Boolean(mapping.fir_year || mapping.crime_date);
  return { mapping, confidence, validDataset: hasIdentity && hasCrime && hasTime, missingMinimum: [!hasIdentity && "district or police_station", !hasCrime && "crime_type or crime_subtype", !hasTime && "fir_year or crime_date"].filter(Boolean) as string[], unmappedColumns: headers.filter((header) => !Object.values(mapping).includes(header)) };
};

export const buildFlexibleCsvPreview = (file: File): Promise<CsvPreview> => new Promise((resolve, reject) => {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    preview: 10,
    skipEmptyLines: true,
    worker: true,
    complete: (result) => {
      const headers = result.meta.fields || [];
      const detected = detectCsvMapping(headers);
      resolve({ headers, rows: result.data, missingRequired: detected.missingMinimum, detectedMapping: detected });
    },
    error: (error) => reject(error)
  });
});

export const analyzeFlexibleCsv = (file: File, mapping: Record<string, string>, onProgress?: (rows: number) => void): Promise<CsvPreview["analysis"]> => new Promise((resolve, reject) => {
  let totalRows = 0;
  let warningRows = 0;
  const districts = new Set<string>();
  const crimeTypes = new Set<string>();
  const years = new Set<number>();
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    worker: true,
    chunk: (result) => {
      result.data.forEach((row) => {
        totalRows += 1;
        const district = String(row[mapping.district] || "").trim();
        const station = String(row[mapping.police_station] || "").trim();
        const type = String(row[mapping.crime_type] || row[mapping.crime_subtype] || "").trim();
        const year = Number(row[mapping.fir_year]);
        if (!district && !station || !type || (!year && !row[mapping.crime_date])) warningRows += 1;
        if (district && districts.size < 100) districts.add(district);
        if (type && crimeTypes.size < 100) crimeTypes.add(type);
        if (Number.isFinite(year) && year > 1900) years.add(year);
      });
      onProgress?.(totalRows);
    },
    complete: () => {
      const orderedYears = [...years].sort((a, b) => a - b);
      resolve({ totalRows, validRows: Math.max(totalRows - warningRows, 0), warningRows, detectedDistricts: [...districts], detectedCrimeTypes: [...crimeTypes], detectedDateRange: orderedYears.length ? `${orderedYears[0]}-${orderedYears[orderedYears.length - 1]}` : "No date range detected" });
    },
    error: (error) => reject(error)
  });
});
