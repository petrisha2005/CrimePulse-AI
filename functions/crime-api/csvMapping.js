const crypto = require("crypto");

const CANONICAL_FIELDS = [
  "crime_id", "district", "police_station", "crime_type", "crime_subtype", "severity_original",
  "fir_year", "fir_month", "fir_day", "crime_date", "latitude_value", "longitude_value",
  "offence_location", "beat_name", "village_area_name", "fir_stage", "complaint_mode",
  "act_section", "victim_count", "accused_count", "arrested_count", "conviction_count", "unit_id"
];

const SYNONYMS = {
  crime_id: ["crime_id", "crime id", "fir number", "fir no", "case id", "case number"],
  district: ["District_Name", "District", "district", "district_name", "DISTRICT", "districtName"],
  police_station: ["UnitName", "Police_Station", "police_station", "Police Station", "Station", "PS", "policeStation"],
  crime_type: ["CrimeGroup_Name", "Crime Type", "crime_type", "Category", "Offence Type", "Offense Type", "CrimeGroup"],
  crime_subtype: ["CrimeHead_Name", "Crime Head", "crime_subtype", "Sub Type", "SubCategory", "Offence Head", "CrimeHead"],
  severity_original: ["FIR Type", "FIR_Type", "Severity", "severity", "Case Type"],
  fir_year: ["FIR_YEAR", "Year", "year", "Crime Year", "Report Year"],
  fir_month: ["FIR_MONTH", "Month", "month", "Crime Month", "Report Month"],
  fir_day: ["FIR_Day", "Day", "day", "Crime Day", "Report Day"],
  crime_date: ["crime_date", "Crime Date", "FIR Date", "Reported Date", "Date", "Incident Date"],
  latitude_value: ["Latitude", "latitude", "lat", "LAT", "Y", "geo_lat"],
  longitude_value: ["Longitude", "longitude", "lon", "lng", "LONG", "X", "geo_lng"],
  offence_location: ["Place of Offence", "Location", "Offence Location", "Area", "Address", "Place"],
  beat_name: ["Beat_Name", "Beat", "beat", "Beat Name"],
  village_area_name: ["Village_Area_Name", "Village", "Area", "Locality", "Ward"],
  fir_stage: ["FIR_Stage", "FIR Stage", "Status", "Case Status", "Investigation Status", "stage"],
  complaint_mode: ["Complaint_Mode", "Complaint Mode", "Mode", "Reporting Mode"],
  act_section: ["ActSection", "Act Section", "IPC Section", "Law Section", "Section"],
  victim_count: ["VICTIM COUNT", "Victim Count", "victims", "victim_count", "Total Victims"],
  accused_count: ["Accused Count", "accused_count", "Accused", "Total Accused"],
  arrested_count: ["Arrested Count No.", "Arrested Count", "arrested_count", "Arrested"],
  conviction_count: ["Conviction Count", "conviction_count", "Convictions"],
  unit_id: ["Unit_ID", "unit_id", "Unit ID", "Station ID"]
};

const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (value) => String(value ?? "").trim();

const similarity = (left, right) => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  const tokens = new Set(left.match(/[a-z]+|\d+/g) || []);
  const other = new Set(right.match(/[a-z]+|\d+/g) || []);
  const shared = [...tokens].filter((token) => other.has(token)).length;
  return shared ? shared / Math.max(tokens.size, other.size) : 0;
};

function detectMapping(headers = []) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  const mapping = {};
  const confidence = {};
  const used = new Set();

  CANONICAL_FIELDS.forEach((field) => {
    const candidates = [field, ...(SYNONYMS[field] || [])].map(normalizeHeader);
    let best = null;
    normalizedHeaders.forEach((candidate) => {
      if (used.has(candidate.header)) return;
      const score = Math.max(...candidates.map((name) => similarity(candidate.normalized, name)));
      if (!best || score > best.score) best = { ...candidate, score };
    });
    if (best && best.score >= 0.62) {
      mapping[field] = best.header;
      confidence[field] = Math.round(best.score * 100);
      used.add(best.header);
    } else {
      mapping[field] = "";
      confidence[field] = 0;
    }
  });

  const hasIdentity = Boolean(mapping.district || mapping.police_station);
  const hasCrime = Boolean(mapping.crime_type || mapping.crime_subtype);
  const hasTime = Boolean(mapping.fir_year || mapping.crime_date);
  return {
    mapping,
    confidence,
    validDataset: hasIdentity && hasCrime && hasTime,
    missingMinimum: [
      !hasIdentity && "district or police_station",
      !hasCrime && "crime_type or crime_subtype",
      !hasTime && "fir_year or crime_date"
    ].filter(Boolean),
    unmappedColumns: headers.filter((header) => !Object.values(mapping).includes(header))
  };
}

const getValue = (row, field, mapping = {}) => clean(row?.[mapping[field]] ?? row?.[field]);
const numberValue = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};
const optionalNumber = (value) => {
  if (!clean(value)) return "";
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? parsed : "";
};
const monthNumber = (value) => {
  const raw = clean(value).toLowerCase();
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const names = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  return names[raw] || 0;
};
const dateParts = (value) => {
  const raw = clean(value);
  if (!raw) return {};
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? {} : { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
};
const crimeDate = (year, month, day) => year && month && day ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
const severity = (value) => {
  const raw = clean(value).toLowerCase();
  if (raw.includes("non heinous") || raw.includes("non-heinous")) return "Medium";
  if (raw.includes("heinous") || raw.includes("critical")) return "High";
  return "Low";
};
const stableCrimeId = (record) => `CP-${crypto.createHash("sha256").update([record.district, record.police_station, record.crime_type, record.crime_subtype, record.fir_year, record.fir_month, record.fir_day, record.offence_location].join("|").toLowerCase()).digest("hex").slice(0, 24)}`;

function mapCrimeRow(row, mapping, rowNumber) {
  const suppliedDate = getValue(row, "crime_date", mapping);
  const fromDate = dateParts(suppliedDate);
  const year = numberValue(getValue(row, "fir_year", mapping), fromDate.year || 0);
  const month = monthNumber(getValue(row, "fir_month", mapping)) || fromDate.month || 0;
  const day = numberValue(getValue(row, "fir_day", mapping), fromDate.day || 0);
  const severityOriginal = getValue(row, "severity_original", mapping);
  const record = {
    crime_id: getValue(row, "crime_id", mapping),
    district: getValue(row, "district", mapping),
    police_station: getValue(row, "police_station", mapping),
    crime_type: getValue(row, "crime_type", mapping),
    crime_subtype: getValue(row, "crime_subtype", mapping),
    severity: severity(severityOriginal),
    severity_original: severityOriginal,
    fir_year: year ? String(year) : "",
    fir_month: month ? String(month) : "",
    fir_day: day ? String(day) : "",
    crime_date: suppliedDate && fromDate.year ? crimeDate(fromDate.year, fromDate.month, fromDate.day) : crimeDate(year, month, day),
    latitude_value: optionalNumber(getValue(row, "latitude_value", mapping)),
    longitude_value: optionalNumber(getValue(row, "longitude_value", mapping)),
    offence_location: getValue(row, "offence_location", mapping),
    beat_name: getValue(row, "beat_name", mapping),
    village_area_name: getValue(row, "village_area_name", mapping),
    fir_stage: getValue(row, "fir_stage", mapping),
    complaint_mode: getValue(row, "complaint_mode", mapping),
    act_section: getValue(row, "act_section", mapping),
    victim_count: numberValue(getValue(row, "victim_count", mapping)),
    accused_count: numberValue(getValue(row, "accused_count", mapping)),
    arrested_count: numberValue(getValue(row, "arrested_count", mapping)),
    conviction_count: numberValue(getValue(row, "conviction_count", mapping)),
    unit_id: getValue(row, "unit_id", mapping),
    created_time: new Date().toISOString()
  };
  record.crime_id = record.crime_id || stableCrimeId(record) || `CP-${rowNumber}`;
  const errors = [];
  const warnings = [];
  if (!record.district && !record.police_station) errors.push("district or police_station is required");
  if (!record.crime_type && !record.crime_subtype) errors.push("crime_type or crime_subtype is required");
  if (!record.fir_year && !record.crime_date) errors.push("fir_year or crime_date is required");
  if (record.latitude_value === "" && clean(getValue(row, "latitude_value", mapping))) warnings.push("invalid latitude omitted");
  if (record.longitude_value === "" && clean(getValue(row, "longitude_value", mapping))) warnings.push("invalid longitude omitted");
  if (!record.crime_date) warnings.push("crime date unavailable");
  return { record, errors, warnings, rowNumber };
}

module.exports = { CANONICAL_FIELDS, SYNONYMS, detectMapping, mapCrimeRow, normalizeHeader, stableCrimeId };
