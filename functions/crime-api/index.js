const fs = require("fs");
const crypto = require("crypto");
const { parse } = require("csv-parse");
const { formidable } = require("formidable");
const catalyst = require("zcatalyst-sdk-node");
const { clearAnalyticsCache, fetchCrimeRecords, forEachCrimeRecordPage, filterOptions } = require("./crimeAnalytics");
const { CANONICAL_FIELDS, detectMapping, mapCrimeRow } = require("./csvMapping");

// Configure CRIME_RECORDS_TABLE in Catalyst Function environment variables if
// your Catalyst Data Store requires a table ID or a table name different from CrimeRecords.
const CRIME_RECORDS_TABLE = process.env.CRIME_RECORDS_TABLE || process.env.CRIME_TABLE || "CrimeRecords";
const BATCH_SIZE = Number(process.env.CSV_INSERT_BATCH_SIZE || 200);
const UPLOAD_BATCH_SIZE = Math.min(200, Math.max(50, Number(process.env.CSV_UPLOAD_BATCH_SIZE || 100)));
const uploadSessions = new Map();
// Set DATASET_METADATA_COLUMNS=true only after adding the optional dataset columns
// to Catalyst Data Store CrimeRecords. Keeping this false preserves older tables.
const DATASET_METADATA_COLUMNS = process.env.DATASET_METADATA_COLUMNS === "true";
const DATASET_FIELDS = ["dataset_id", "dataset_name", "upload_id", "source_file_name", "imported_at"];

const REQUIRED_CSV_COLUMNS = ["District_Name", "UnitName", "FIR_YEAR", "FIR_MONTH", "FIR_Day", "CrimeGroup_Name"];
const ALLOWED_CRIME_RECORD_FIELDS = [
  "crime_id",
  "district",
  "police_station",
  "crime_type",
  "crime_subtype",
  "severity",
  "severity_original",
  "fir_year",
  "fir_month",
  "fir_day",
  "crime_date",
  "latitude_value",
  "longitude_value",
  "offence_location",
  "beat_name",
  "village_area_name",
  "fir_stage",
  "complaint_mode",
  "act_section",
  "victim_count",
  "accused_count",
  "arrested_count",
  "conviction_count",
  "unit_id",
  "created_time"
].concat(DATASET_METADATA_COLUMNS ? DATASET_FIELDS : []);
const CRIME_FIELDS = ALLOWED_CRIME_RECORD_FIELDS;
const CSV_TO_DATASTORE_MAPPING = {
  crime_id: "Generated if missing",
  district: "District_Name",
  police_station: "UnitName",
  crime_type: "CrimeGroup_Name",
  crime_subtype: "CrimeHead_Name",
  severity: "FIR Type normalized",
  severity_original: "FIR Type",
  fir_year: "FIR_YEAR",
  fir_month: "FIR_MONTH",
  fir_day: "FIR_Day",
  crime_date: "FIR_YEAR + FIR_MONTH + FIR_Day",
  latitude_value: "Latitude",
  longitude_value: "Longitude",
  offence_location: "Place of Offence",
  beat_name: "Beat_Name",
  village_area_name: "Village_Area_Name",
  fir_stage: "FIR_Stage",
  complaint_mode: "Complaint_Mode",
  act_section: "ActSection",
  victim_count: "VICTIM COUNT",
  accused_count: "Accused Count",
  arrested_count: "Arrested Count No.",
  conviction_count: "Conviction Count",
  unit_id: "Unit_ID",
  created_time: "Current ISO timestamp"
};

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const send = (res, status, payload) => {
  res.writeHead(status, CORS_HEADERS);
  res.end(JSON.stringify(payload));
};

const sendOptions = (res) => {
  res.writeHead(204, CORS_HEADERS);
  res.end();
};

const SERVICE_NAME = "crime-api";
const AVAILABLE_ROUTES = [
  "GET /",
  "GET /health",
  "GET /crimes",
  "GET /crimes/count",
  "POST /crimes/clear-all",
  "POST /crimes/clear-batch",
  "GET /crimes/filter",
  "GET /crimes/filters",
  "GET /crimes/debug/mapping",
  "GET /crimes/schema-check",
  "GET /crimes/:ROWID",
  "POST /crimes",
  "PUT /crimes/:ROWID",
  "DELETE /crimes/:ROWID",
  "POST /crimes/upload-csv",
  "POST /crimes/upload-session/start",
  "POST /crimes/upload-batch",
  "POST /crimes/upload-session/finish"
  ,"GET /datasets"
  ,"GET /datasets/:dataset_id/summary"
  ,"DELETE /datasets/:dataset_id"
  ,"POST /datasets/clear-all"
];

function getPath(req, serviceName) {
  const rawUrl = req.url || "/";
  const urlOnly = rawUrl.split("?")[0];

  return urlOnly
    .replace(`/server/${serviceName}`, "")
    .replace(new RegExp(`^/${serviceName}`), "")
    .replace(/\/+$/, "") || "/";
}

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });

const getApp = (req) => catalyst.initialize(req);
const getTable = (req) => getApp(req).datastore().table(CRIME_RECORDS_TABLE);
const executeZcql = (req, query) => getApp(req).zcql().executeZCQLQuery(query);
const invalidateAnalyticsCache = async (req, reason) => {
  try {
    const removed = await clearAnalyticsCache(getApp(req));
    console.log("[crime-api] analytics cache invalidated", { reason, removed });
  } catch (error) {
    console.warn("[crime-api] analytics cache invalidation skipped", { reason, error: error.message });
  }
};

const flatten = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === "object") return Object.values(value).flatMap(flatten);
  return [value];
};

const firstNumber = (row) => {
  const numeric = flatten(row).find((value) => Number.isFinite(Number(value)));
  return Number.isFinite(Number(numeric)) ? Number(numeric) : 0;
};

const getStoredCount = async (req) => {
  const rows = await executeZcql(req, `SELECT COUNT(ROWID) FROM ${CRIME_RECORDS_TABLE}`);
  return rows[0] ? firstNumber(rows[0]) : 0;
};

const datasetMode = (count) => count > 100000 ? "large" : count > 10000 ? "medium" : "small";

const getStorageErrorMessage = (error) => {
  const raw = error?.message || error?.toString?.() || "Unknown Data Store insert error";
  const lower = raw.toLowerCase();
  if (lower.includes("not found") || lower.includes("no such table") || lower.includes("invalid table")) {
    return `Data Store table not found. Check CRIME_RECORDS_TABLE/CRIME_TABLE and Catalyst table name or table ID. Details: ${raw}`;
  }
  if (lower.includes("column") || lower.includes("field") || lower.includes("invalid")) {
    return `Invalid Data Store column or field type. Confirm CrimeRecords columns match the upload mapping. Details: ${raw}`;
  }
  if (lower.includes("auth") || lower.includes("permission") || lower.includes("unauthorized")) {
    return `Catalyst authentication or Data Store permission issue. Details: ${raw}`;
  }
  if (lower.includes("payload") || lower.includes("size") || lower.includes("too large")) {
    return `Batch payload too large. Reduce CSV_INSERT_BATCH_SIZE or upload a smaller file. Details: ${raw}`;
  }
  return `insertRows failed. Details: ${raw}`;
};

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

function getCsvValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function toSafeNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const monthNumber = (value) => {
  const raw = String(value || "").trim();
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const lookup = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };
  return lookup[raw.toLowerCase()] || 0;
};

const buildDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

function buildCrimeDate(year, month, day) {
  const y = String(year || "").padStart(4, "0");
  const m = String(month || "1").padStart(2, "0");
  const d = String(day || "1").padStart(2, "0");
  if (!y || y === "0000") return "";
  return `${y}-${m}-${d}`;
}

const normalizeSeverity = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "heinous") return "High";
  if (normalized === "non heinous" || normalized === "non-heinous") return "Medium";
  return "Low";
};

function mapSeverity(firType) {
  const value = String(firType || "").toLowerCase();
  if (value.includes("non heinous") || value.includes("non-heinous")) return "Medium";
  if (value.includes("heinous")) return "High";
  return "Low";
}

const generatedCrimeId = (record, rowNumber) =>
  `KA-${record.fir_year || "YYYY"}-${String(record.district || "UNKNOWN").replace(/\s+/g, "-").toUpperCase()}-${String(rowNumber).padStart(6, "0")}`;

const validateCsvRow = (row) => {
  const errors = [];
  REQUIRED_CSV_COLUMNS.forEach((column) => {
    if (row[column] === undefined || row[column] === null || String(row[column]).trim() === "") {
      errors.push(`${column} is required`);
    }
  });

  const year = toNumber(row.FIR_YEAR);
  const month = monthNumber(row.FIR_MONTH);
  const day = toNumber(row.FIR_Day);
  if (!buildDate(year, month, day)) {
    errors.push("FIR_YEAR, FIR_MONTH, and FIR_Day must form a valid date");
  }

  if (String(row.Latitude || "").trim() && toOptionalNumber(row.Latitude) === null) {
    errors.push("Latitude must be a number when present");
  }

  if (String(row.Longitude || "").trim() && toOptionalNumber(row.Longitude) === null) {
    errors.push("Longitude must be a number when present");
  }

  return errors;
};

function sanitizeCrimeRecord(record) {
  const cleanRecord = {};
  for (const key of ALLOWED_CRIME_RECORD_FIELDS) {
    if (record[key] !== undefined && record[key] !== null) {
      cleanRecord[key] = record[key];
    }
  }
  return cleanRecord;
}

function transformCsvRowToCrimeRecord(row, index) {
  const district = getCsvValue(row, ["District_Name", "district"]);
  const policeStation = getCsvValue(row, ["UnitName", "police_station"]);
  const firYear = getCsvValue(row, ["FIR_YEAR", "fir_year"]);
  const firMonthRaw = getCsvValue(row, ["FIR_MONTH", "fir_month"]);
  const firDay = getCsvValue(row, ["FIR_Day", "fir_day"]);
  const firType = getCsvValue(row, ["FIR Type", "severity_original"]);
  const crimeType = getCsvValue(row, ["CrimeGroup_Name", "crime_type"]);
  const crimeSubtype = getCsvValue(row, ["CrimeHead_Name", "crime_subtype"]);
  const firMonth = monthNumber(firMonthRaw) || firMonthRaw;

  const record = {
    crime_id: getCsvValue(row, ["crime_id"]) || `CRIME-${Date.now()}-${index}`,
    district,
    police_station: policeStation,
    crime_type: crimeType,
    crime_subtype: crimeSubtype,
    severity: mapSeverity(firType),
    severity_original: firType,
    fir_year: firYear,
    fir_month: firMonth,
    fir_day: firDay,
    crime_date: buildCrimeDate(firYear, firMonth, firDay),
    latitude_value: getCsvValue(row, ["Latitude", "latitude_value"]),
    longitude_value: getCsvValue(row, ["Longitude", "longitude_value"]),
    offence_location: getCsvValue(row, ["Place of Offence", "offence_location"]),
    beat_name: getCsvValue(row, ["Beat_Name", "beat_name"]),
    village_area_name: getCsvValue(row, ["Village_Area_Name", "village_area_name"]),
    fir_stage: getCsvValue(row, ["FIR_Stage", "fir_stage"]),
    complaint_mode: getCsvValue(row, ["Complaint_Mode", "complaint_mode"]),
    act_section: getCsvValue(row, ["ActSection", "act_section"]),
    victim_count: toSafeNumber(getCsvValue(row, ["VICTIM COUNT", "victim_count"])),
    accused_count: toSafeNumber(getCsvValue(row, ["Accused Count", "accused_count"])),
    arrested_count: toSafeNumber(getCsvValue(row, ["Arrested Count No.", "Arrested Count\tNo.", "arrested_count"])),
    conviction_count: toSafeNumber(getCsvValue(row, ["Conviction Count", "conviction_count"])),
    unit_id: getCsvValue(row, ["Unit_ID", "unit_id"]),
    created_time: new Date().toISOString()
  };

  return sanitizeCrimeRecord(record);
}

const mapCsvRow = (row, rowNumber) => transformCsvRowToCrimeRecord(row, rowNumber);

const normalizeApiRecord = (record) => {
  const normalized = {};
  CRIME_FIELDS.forEach((field) => {
    normalized[field] = record[field] ?? "";
  });

  normalized.fir_year = toNumber(record.fir_year);
  normalized.fir_month = toNumber(record.fir_month);
  normalized.fir_day = toNumber(record.fir_day);
  normalized.crime_date = normalized.crime_date || buildDate(normalized.fir_year, normalized.fir_month, normalized.fir_day);
  normalized.latitude_value = toOptionalNumber(record.latitude_value);
  normalized.longitude_value = toOptionalNumber(record.longitude_value);
  normalized.offence_location = normalized.offence_location || "";
  normalized.village_area_name = normalized.village_area_name || "";
  normalized.fir_stage = normalized.fir_stage || "";
  normalized.victim_count = toNumber(record.victim_count);
  normalized.accused_count = toNumber(record.accused_count);
  normalized.arrested_count = toNumber(record.arrested_count);
  normalized.conviction_count = toNumber(record.conviction_count);
  normalized.created_time = normalized.created_time || new Date().toISOString();
  normalized.severity = ["Low", "Medium", "High", "Critical"].includes(normalized.severity) ? normalized.severity : "Low";
  return normalized;
};

const validateApiRecord = (record) => {
  const errors = [];
  ["district", "police_station", "crime_type", "fir_year", "fir_month", "fir_day"].forEach((field) => {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === "") {
      errors.push(`${field} is required`);
    }
  });
  if (!buildDate(toNumber(record.fir_year), toNumber(record.fir_month), toNumber(record.fir_day))) {
    errors.push("fir_year, fir_month, and fir_day must form a valid date");
  }
  return errors;
};

const toClientRecord = (row) => ({
  ROWID: row.ROWID,
  crime_id: row.crime_id,
  district: row.district,
  police_station: row.police_station,
  crime_type: row.crime_type,
  crime_subtype: row.crime_subtype,
  severity: row.severity,
  severity_original: row.severity_original,
  fir_year: toNumber(row.fir_year),
  fir_month: toNumber(row.fir_month),
  fir_day: toNumber(row.fir_day),
  crime_date: row.crime_date,
  latitude_value: toOptionalNumber(row.latitude_value),
  longitude_value: toOptionalNumber(row.longitude_value),
  offence_location: row.offence_location,
  beat_name: row.beat_name,
  village_area_name: row.village_area_name,
  fir_stage: row.fir_stage,
  complaint_mode: row.complaint_mode,
  act_section: row.act_section,
  victim_count: toNumber(row.victim_count),
  accused_count: toNumber(row.accused_count),
  arrested_count: toNumber(row.arrested_count),
  conviction_count: toNumber(row.conviction_count),
    unit_id: row.unit_id,
    created_time: row.created_time,
    dataset_id: row.dataset_id || "",
    dataset_name: row.dataset_name || "",
    upload_id: row.upload_id || "",
    source_file_name: row.source_file_name || "",
    imported_at: row.imported_at || ""
});

const getAllCrimes = async (req) => {
  return fetchCrimeRecords(getApp(req));
};

const dynamicFilterFields = ["fir_year", "fir_month", "district", "police_station", "crime_type", "crime_subtype", "severity", "fir_stage", "complaint_mode", "beat_name", "village_area_name"];

const sortFilterValues = (values) => [...values].filter(Boolean).sort((left, right) => {
  const numericLeft = Number(left);
  const numericRight = Number(right);
  if (Number.isFinite(numericLeft) && Number.isFinite(numericRight)) return numericLeft - numericRight;
  return String(left).localeCompare(String(right));
});

const getDynamicFilterOptions = async (req, params) => {
  const scoped = {
    fir_year: params.fir_year || params.year,
    fir_month: params.fir_month || params.month,
    district: params.selectedDistrict || params.district,
    police_station: params.selectedPoliceStation || params.police_station,
    crime_type: params.selectedCrimeType || params.crime_type,
    severity: params.severity,
    fir_stage: params.fir_stage || params.status
  };
  const values = Object.fromEntries(dynamicFilterFields.map((field) => [field, new Set()]));
  try {
    await forEachCrimeRecordPage(getApp(req), scoped, 500, async (records) => {
      records.forEach((record) => dynamicFilterFields.forEach((field) => {
        const value = String(record[field] || "").trim();
        if (value) values[field].add(value);
      }));
    });
  } catch (error) {
    console.warn("[crime-api] paginated filter collection failed; using bounded fallback", error.message);
    const records = filterCrimes(await getAllCrimes(req), scoped);
    records.forEach((record) => dynamicFilterFields.forEach((field) => {
      const value = String(record[field] || "").trim();
      if (value) values[field].add(value);
    }));
  }
  const result = Object.fromEntries(dynamicFilterFields.map((field) => [field, sortFilterValues(values[field]) ]));
  return {
    ...result,
    years: result.fir_year,
    months: result.fir_month,
    districts: result.district,
    policeStations: result.police_station,
    crimeTypes: result.crime_type,
    crimeSubtypes: result.crime_subtype,
    severities: result.severity,
    statuses: result.fir_stage,
    firStages: result.fir_stage,
    complaintModes: result.complaint_mode,
    beats: result.beat_name,
    villages: result.village_area_name
  };
};

const activeValue = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const normalizeCrimeQuery = (params) => ({
  page: Math.max(1, toNumber(params.page, 1)),
  limit: Math.min(100, Math.max(1, toNumber(params.limit, 25))),
  search: String(params.search || "").trim().toLowerCase(),
  fir_year: activeValue(params.fir_year) ? String(params.fir_year) : activeValue(params.year) ? String(params.year) : "",
  fir_month: activeValue(params.fir_month) ? String(params.fir_month) : activeValue(params.month) ? String(params.month) : "",
  district: activeValue(params.district) ? String(params.district) : "",
  police_station: activeValue(params.police_station) ? String(params.police_station) : "",
  crime_type: activeValue(params.crime_type) ? String(params.crime_type) : "",
  severity: activeValue(params.severity) ? String(params.severity) : "",
  fir_stage: activeValue(params.fir_stage) ? String(params.fir_stage) : activeValue(params.status) ? String(params.status) : "",
  dataset_id: activeValue(params.dataset_id) ? String(params.dataset_id) : ""
});

const searchableFields = ["crime_id", "district", "police_station", "crime_type", "crime_subtype", "fir_stage", "complaint_mode", "act_section", "offence_location"];

const filterCrimes = (crimes, params) => {
  const query = normalizeCrimeQuery(params);
  return crimes.filter((crime) => {
    if (query.fir_year && String(crime.fir_year) !== query.fir_year) return false;
    if (query.fir_month && String(crime.fir_month) !== query.fir_month) return false;
    if (query.district && crime.district !== query.district) return false;
    if (query.police_station && crime.police_station !== query.police_station) return false;
    if (query.crime_type && crime.crime_type !== query.crime_type) return false;
    if (query.severity && crime.severity !== query.severity && crime.severity_original !== query.severity) return false;
    if (query.fir_stage && crime.fir_stage !== query.fir_stage) return false;
    if (query.dataset_id && crime.dataset_id !== query.dataset_id) return false;
    if (query.search && !searchableFields.some((field) => String(crime[field] || "").toLowerCase().includes(query.search))) return false;
    return true;
  });
};

const paginateCrimes = (crimes, params) => {
  const query = normalizeCrimeQuery(params);
  const totalRecords = crimes.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / query.limit));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;
  return {
    data: crimes.slice(start, start + query.limit),
    pagination: {
      page,
      limit: query.limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
};

const parseMultipart = (req) => {
  const form = formidable({
    multiples: false,
    maxFileSize: Number(process.env.CSV_MAX_FILE_SIZE || 100 * 1024 * 1024)
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
};

const insertBatch = async (table, batch, batchNumber) => {
  if (batch.length === 0) return { inserted: 0, error: null };
  console.log(`[crime-api] batch insert started`, { batchNumber, rows: batch.length });
  try {
    await table.insertRows(batch);
    console.log(`[crime-api] batch insert completed`, { batchNumber, rows: batch.length });
    return { inserted: batch.length, error: null };
  } catch (error) {
    const message = getStorageErrorMessage(error);
    console.error(`[crime-api] batch insert failed`, { batchNumber, rows: batch.length, error: message });
    return {
      inserted: 0,
      error: `Batch ${batchNumber}: ${message}`,
      samplePayloadKeys: Object.keys(batch[0] || {}),
      samplePayload: batch[0] || null
    };
  }
};

const escapeZcql = (value) => String(value ?? "").replace(/'/g, "''");

const existingCrimeRows = async (req, ids, datasetId = "") => {
  const uniqueIds = [...new Set(ids.filter(Boolean))].slice(0, 200);
  if (!uniqueIds.length) return new Map();
  try {
    const values = uniqueIds.map((id) => `'${escapeZcql(id)}'`).join(",");
    const datasetClause = DATASET_METADATA_COLUMNS && datasetId ? ` AND dataset_id = '${escapeZcql(datasetId)}'` : "";
    const rows = await executeZcql(req, `SELECT ROWID, crime_id FROM ${CRIME_RECORDS_TABLE} WHERE crime_id IN (${values})${datasetClause}`);
    return new Map(rows.map((row) => {
      const source = row?.[CRIME_RECORDS_TABLE] || row;
      return [source?.crime_id, source?.ROWID];
    }).filter(([crimeId, rowId]) => crimeId && rowId));
  } catch (error) {
    console.warn("[crime-api] duplicate lookup skipped", error.message);
    return new Map();
  }
};

const createSession = (metadata = {}) => {
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const session = {
    upload_id: uploadId,
    started_at: new Date().toISOString(),
    total_rows: 0,
    valid_rows: 0,
    inserted_rows: 0,
    skipped_duplicates: 0,
    failed_rows: 0,
    warning_rows: 0,
    validation_errors: [],
    failed_row_details: [],
    districts: new Set(),
    crime_types: new Set(),
    years: new Set(),
    seen_ids: new Set(),
    batch_errors: [],
    cleared_existing_records: false
  };
  session.import_mode = metadata.import_mode || "new_dataset";
  session.dataset_id = metadata.dataset_id || createDatasetId();
  session.dataset_name = String(metadata.dataset_name || "Untitled dataset").trim();
  session.source_file_name = String(metadata.source_file_name || "").trim();
  uploadSessions.set(uploadId, session);
  return session;
};

const createDatasetId = () => `dataset-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;

const clearAllCrimeRecords = async (req) => {
  const table = getTable(req);
  let deleted = 0;
  while (true) {
    const rows = await executeZcql(req, `SELECT ROWID FROM ${CRIME_RECORDS_TABLE} LIMIT 200`);
    const rowIds = rows.map((row) => row?.[CRIME_RECORDS_TABLE]?.ROWID || row?.ROWID).filter(Boolean);
    if (!rowIds.length) break;
    for (const rowId of rowIds) {
      await table.deleteRow(rowId);
      deleted += 1;
    }
  }
  return deleted;
};

const clearCrimeRecordsBatch = async (req, requestedBatchSize) => {
  const parsedBatchSize = Number(requestedBatchSize);
  const batchSize = Number.isFinite(parsedBatchSize) ? Math.min(200, Math.max(1, Math.floor(parsedBatchSize))) : 200;
  const rows = await executeZcql(req, `SELECT ROWID FROM ${CRIME_RECORDS_TABLE} LIMIT ${batchSize}`);
  const rowIds = rows.map((row) => row?.[CRIME_RECORDS_TABLE]?.ROWID || row?.ROWID).filter(Boolean);
  if (!rowIds.length) return { deleted_rows: 0, remaining_records: 0, done: true };

  const table = getTable(req);
  for (let offset = 0; offset < rowIds.length; offset += 10) {
    const results = await Promise.allSettled(rowIds.slice(offset, offset + 10).map((rowId) => table.deleteRow(rowId)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }

  const remaining_records = await getStoredCount(req);
  return { deleted_rows: rowIds.length, remaining_records, done: remaining_records === 0 };
};

const datasetSummary = (records, datasetId) => {
  const scoped = datasetId ? records.filter((record) => record.dataset_id === datasetId) : records;
  const years = [...new Set(scoped.map((record) => record.fir_year).filter(Boolean))].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    dataset_id: datasetId || "all",
    record_count: scoped.length,
    year_range: years.length ? `${years[0]}-${years.at(-1)}` : "No data",
    district_count: new Set(scoped.map((record) => record.district).filter(Boolean)).size,
    crime_type_count: new Set(scoped.map((record) => record.crime_type).filter(Boolean)).size
  };
};

const addSessionError = (session, detail) => {
  if (session.validation_errors.length < 200) session.validation_errors.push(detail);
  if (session.failed_row_details.length < 1000) session.failed_row_details.push(detail);
};

const finalizeSessionSummary = async (req, session) => {
  const totalCount = await getStoredCount(req).catch(() => 0);
  const years = [...session.years].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    success: session.failed_rows === 0 && session.batch_errors.length === 0,
    upload_id: session.upload_id,
    totalRows: session.total_rows,
    validRows: session.valid_rows,
    insertedRows: session.inserted_rows,
    skippedRows: session.skipped_duplicates + session.failed_rows,
    skippedDuplicates: session.skipped_duplicates,
    errorRows: session.failed_rows,
    warningRows: session.warning_rows,
    validationErrors: session.validation_errors,
    failedRowDetails: session.failed_row_details,
    batchErrors: session.batch_errors,
    durationSeconds: Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)),
    detectedDistricts: [...session.districts].slice(0, 100),
    detectedCrimeTypes: [...session.crime_types].slice(0, 100),
    detectedYearRange: years.length ? `${years[0]}-${years.at(-1)}` : "No data",
    storageVerified: session.inserted_rows > 0 && totalCount > 0,
    storedRecordCountAfterUpload: totalCount
  };
};

const processUploadRows = async (req, session, rows, mapping, uploadMode, batchNumber) => {
  const detected = detectMapping(Object.keys(rows[0] || {}));
  const effectiveMapping = { ...detected.mapping, ...(mapping || {}) };
  const table = getTable(req);
  const valid = [];
  rows.forEach((row, index) => {
    session.total_rows += 1;
    const result = mapCrimeRow(row, effectiveMapping, session.total_rows);
    if (result.errors.length) {
      session.failed_rows += 1;
      addSessionError(session, { row: result.rowNumber, errors: result.errors, raw: row });
      return;
    }
    if (result.warnings.length) session.warning_rows += 1;
    if (DATASET_METADATA_COLUMNS) {
      result.record.dataset_id = session.dataset_id;
      result.record.dataset_name = session.dataset_name;
      result.record.upload_id = session.upload_id;
      result.record.source_file_name = session.source_file_name;
      result.record.imported_at = session.started_at;
    }
    session.valid_rows += 1;
    valid.push(result.record);
  });

  const knownRows = await existingCrimeRows(req, valid.map((record) => record.crime_id), session.dataset_id);
  const updates = [];
  const insertable = valid.filter((record) => {
    const existingRowId = knownRows.get(record.crime_id);
    if (session.seen_ids.has(record.crime_id)) {
      session.skipped_duplicates += 1;
      return false;
    }
    if (existingRowId) {
      if (uploadMode === "replace") updates.push({ ...record, ROWID: existingRowId });
      else session.skipped_duplicates += 1;
      return false;
    }
    session.seen_ids.add(record.crime_id);
    session.districts.add(record.district || "Unknown");
    session.crime_types.add(record.crime_type || record.crime_subtype || "Unknown");
    if (record.fir_year) session.years.add(record.fir_year);
    return true;
  });
  for (const update of updates) {
    try {
      await table.updateRow(update);
      session.inserted_rows += 1;
    } catch (error) {
      session.failed_rows += 1;
      addSessionError(session, { row: "matching record", error: getStorageErrorMessage(error) });
    }
  }
  for (let offset = 0; offset < insertable.length; offset += UPLOAD_BATCH_SIZE) {
    const result = await insertBatch(table, insertable.slice(offset, offset + UPLOAD_BATCH_SIZE), `${batchNumber}.${offset / UPLOAD_BATCH_SIZE + 1}`);
    session.inserted_rows += result.inserted;
    if (result.error) {
      session.failed_rows += insertable.slice(offset, offset + UPLOAD_BATCH_SIZE).length;
      session.batch_errors.push(result.error);
      addSessionError(session, { batch: batchNumber, error: result.error });
    }
  }
  return { effectiveMapping, received: rows.length, inserted: insertable.length };
};

const uploadCsv = async (req) => {
  const { files } = await parseMultipart(req);
  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  console.log("[crime-api] CSV upload received", {
    table: CRIME_RECORDS_TABLE,
    filename: file?.originalFilename || file?.newFilename || "missing",
    size: file?.size || 0
  });

  if (!file) {
    return {
      success: false,
      totalRows: 0,
      validRows: 0,
      insertedRows: 0,
      skippedRows: 0,
      errorRows: 1,
      validationErrors: ["CSV file is required"],
      storageVerified: false,
      storedRecordCountAfterUpload: 0,
      batchErrors: []
    };
  }

  const table = getTable(req);
  const validationErrors = [];
  const batchErrors = [];
  let totalRows = 0;
  let validRows = 0;
  let insertedRows = 0;
  let skippedRows = 0;
  let errorRows = 0;
  let batch = [];
  let batchNumber = 0;
  let headersChecked = false;
  let flexibleMapping = null;
  let firstRecord = null;
  let firstInsertLogged = false;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    batchNumber += 1;
    if (!firstInsertLogged && batch[0]) {
      firstInsertLogged = true;
      console.log("[crime-api] Insert payload sample:", batch[0]);
      console.log("[crime-api] Insert payload keys:", Object.keys(batch[0]));
    }
    const result = await insertBatch(table, batch, batchNumber);
    insertedRows += result.inserted;
    if (result.error) {
      batchErrors.push(result.error);
      errorRows += batch.length;
      skippedRows += batch.length;
      if (validationErrors.length < 100) validationErrors.push(result.error);
      if (!firstRecord && result.samplePayload) firstRecord = result.samplePayload;
    }
    batch = [];
  };

  const parser = fs.createReadStream(file.filepath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    })
  );

  for await (const row of parser) {
    totalRows += 1;

    if (!headersChecked) {
      headersChecked = true;
      flexibleMapping = detectMapping(Object.keys(row));
      if (!flexibleMapping.validDataset) {
        validationErrors.push(`This CSV does not look like a crime records dataset. Missing: ${flexibleMapping.missingMinimum.join(", ")}`);
        skippedRows = totalRows;
        break;
      }
      console.log("[crime-api] flexible CSV mapping", flexibleMapping);
    }

    const mapped = mapCrimeRow(row, flexibleMapping.mapping, totalRows);
    if (mapped.errors.length > 0) {
      errorRows += 1;
      skippedRows += 1;
      if (validationErrors.length < 100) {
        validationErrors.push(`Row ${totalRows + 1}: ${mapped.errors.join(", ")}`);
      }
      continue;
    }

    const transformedRecord = mapped.record;
    if (!firstRecord) firstRecord = transformedRecord;
    batch.push(transformedRecord);
    validRows += 1;
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();

  console.log("[crime-api] total parsed rows", totalRows);
  console.log("[crime-api] valid rows", validRows);
  console.log("[crime-api] inserted rows", insertedRows);

  let storedRecordCountAfterUpload = 0;
  let storageVerified = false;
  try {
    storedRecordCountAfterUpload = await getStoredCount(req);
    storageVerified = storedRecordCountAfterUpload > 0 && insertedRows > 0;
    console.log("[crime-api] final stored count", storedRecordCountAfterUpload);
  } catch (error) {
    const message = `Storage verification failed: ${getStorageErrorMessage(error)}`;
    console.error("[crime-api] storage verification failed", message);
    batchErrors.push(message);
    if (validationErrors.length < 100) validationErrors.push(message);
  }

  return {
    success: batchErrors.length === 0 && insertedRows === validRows,
    totalRows,
    validRows,
    insertedRows,
    skippedRows,
    errorRows,
    validationErrors,
    storageVerified,
    storedRecordCountAfterUpload,
    batchErrors,
    samplePayloadKeys: firstRecord ? Object.keys(firstRecord) : [],
    samplePayload: firstRecord
  };
};

module.exports = async (req, res) => {
  const rawUrl = req.url || "/";
  const url = new URL(rawUrl, `https://${req.headers.host || "catalyst.local"}`);
  const path = getPath(req, SERVICE_NAME);

  console.log("[crime-api] method:", req.method);
  console.log("[crime-api] raw url:", req.url);
  console.log("[crime-api] normalized path:", path);

  if (req.method === "OPTIONS") {
    return sendOptions(res);
  }

  if (req.method === "GET" && path === "/health") {
    return send(res, 200, { success: true, service: SERVICE_NAME, status: "running" });
  }

  if (req.method === "GET" && path === "/") {
    return send(res, 200, {
      success: true,
      service: SERVICE_NAME,
      message: `CrimePulse AI ${SERVICE_NAME} is running`,
      availableRoutes: AVAILABLE_ROUTES
    });
  }
  const crimeRowMatch = path.match(/\/crimes\/([^/]+)$/);

  try {
    if (req.method === "GET" && path.endsWith("/crimes/debug/mapping")) {
      return send(res, 200, {
        success: true,
        table: CRIME_RECORDS_TABLE,
        allowedFields: ALLOWED_CRIME_RECORD_FIELDS,
        csvToDataStoreMapping: CSV_TO_DATASTORE_MAPPING,
        canonicalFields: CANONICAL_FIELDS,
        note: "Only allowed fields are inserted into Catalyst."
      });
    }

    if (req.method === "GET" && path.endsWith("/crimes/schema-check")) {
      return send(res, 200, {
        success: true,
        table: CRIME_RECORDS_TABLE,
        allowedFields: ALLOWED_CRIME_RECORD_FIELDS,
        datasetMetadataColumnsEnabled: DATASET_METADATA_COLUMNS,
        optionalDatasetColumns: DATASET_FIELDS,
        systemColumnsNotInserted: ["ROWID", "CREATORID", "CREATEDTIME", "MODIFIEDTIME"],
        message: "Verify these columns exist in Catalyst Data Store table CrimeRecords."
      });
    }

    if (req.method === "GET" && path === "/datasets") {
      if (!DATASET_METADATA_COLUMNS) return send(res, 200, { success: true, data: [], message: "Dataset metadata is disabled. Add optional columns and set DATASET_METADATA_COLUMNS=true." });
      const records = await getAllCrimes(req);
      const groups = new Map();
      records.forEach((record) => {
        if (!record.dataset_id) return;
        if (!groups.has(record.dataset_id)) groups.set(record.dataset_id, { dataset_id: record.dataset_id, dataset_name: record.dataset_name || record.dataset_id, source_file_name: record.source_file_name || "", upload_id: record.upload_id || "", imported_at: record.imported_at || record.created_time || "" });
      });
      return send(res, 200, { success: true, data: [...groups.values()].map((dataset) => ({ ...dataset, ...datasetSummary(records, dataset.dataset_id) })).sort((a, b) => String(b.imported_at).localeCompare(String(a.imported_at))) });
    }

    const datasetMatch = path.match(/^\/datasets\/([^/]+)(?:\/summary)?$/);
    if (datasetMatch && req.method === "GET" && path.endsWith("/summary")) {
      if (!DATASET_METADATA_COLUMNS) return send(res, 400, { success: false, message: "Dataset metadata columns are not enabled." });
      const records = await getAllCrimes(req);
      return send(res, 200, { success: true, data: datasetSummary(records, decodeURIComponent(datasetMatch[1])) });
    }

    if (datasetMatch && req.method === "DELETE") {
      if (!DATASET_METADATA_COLUMNS) return send(res, 400, { success: false, message: "Dataset metadata columns are not enabled." });
      const body = await readJsonBody(req);
      if (body.confirmation !== "DELETE") return send(res, 400, { success: false, message: "Enter confirmation: DELETE before removing this dataset." });
      const datasetId = decodeURIComponent(datasetMatch[1]);
      const records = await getAllCrimes(req);
      const table = getTable(req);
      const matches = records.filter((record) => record.dataset_id === datasetId && record.ROWID);
      for (const record of matches) await table.deleteRow(record.ROWID);
      return send(res, 200, { success: true, data: { dataset_id: datasetId, deleted_records: matches.length } });
    }

    if (req.method === "POST" && path === "/datasets/clear-all") {
      const body = await readJsonBody(req);
      if (body.confirmation !== "RESET") return send(res, 400, { success: false, message: "Enter confirmation: RESET before clearing CrimeRecords." });
      const deleted = await clearAllCrimeRecords(req);
      await invalidateAnalyticsCache(req, "datasets-clear-all");
      return send(res, 200, { success: true, data: { deleted_records: deleted } });
    }

    if (req.method === "GET" && path.endsWith("/crimes/count")) {
      const totalRecords = await getStoredCount(req);
      return send(res, 200, { data: { totalRecords, datasetMode: datasetMode(totalRecords) }, totalRecords, datasetMode: datasetMode(totalRecords) });
    }

    if (req.method === "POST" && path.endsWith("/crimes/clear-all")) {
      const body = await readJsonBody(req);
      if (body.confirmation !== "RESET") return send(res, 400, { success: false, message: "Enter confirmation: RESET before clearing CrimeRecords." });
      const deleted_rows = await clearAllCrimeRecords(req);
      await invalidateAnalyticsCache(req, "crimes-clear-all");
      console.log("[crime-api] CrimeRecords cleared", { deleted_rows });
      return send(res, 200, { success: true, deleted_rows, totalRecords: 0, message: "CrimeRecords cleared successfully.", data: { deleted_rows, totalRecords: 0, message: "CrimeRecords cleared successfully." } });
    }

    if (req.method === "POST" && path.endsWith("/crimes/clear-batch")) {
      const body = await readJsonBody(req);
      if (body.confirmation !== "RESET") return send(res, 400, { success: false, message: "Enter confirmation: RESET before clearing CrimeRecords." });
      const result = await clearCrimeRecordsBatch(req, body.batch_size);
      if (result.deleted_rows > 0 || result.done) await invalidateAnalyticsCache(req, "crimes-clear-batch");
      console.log("[crime-api] CrimeRecords clear batch complete", result);
      return send(res, 200, {
        success: true,
        ...result,
        deleted: result.deleted_rows,
        remaining: result.remaining_records,
        data: {
          ...result,
          deleted: result.deleted_rows,
          remaining: result.remaining_records
        }
      });
    }

    if (req.method === "GET" && path.endsWith("/crimes/filters")) {
      const options = await getDynamicFilterOptions(req, Object.fromEntries(url.searchParams.entries()));
      return send(res, 200, {
        success: true,
        data: {
          fir_year: options.fir_year,
          fir_month: options.fir_month,
          district: options.district,
          police_station: options.police_station,
          crime_type: options.crime_type,
          crime_subtype: options.crime_subtype,
          severity: options.severity,
          fir_stage: options.fir_stage,
          complaint_mode: options.complaint_mode,
          beat_name: options.beat_name,
          village_area_name: options.village_area_name,
          years: options.years,
          months: options.months,
          districts: options.districts,
          policeStations: options.policeStations,
          crimeTypes: options.crimeTypes,
          crimeSubtypes: options.crimeSubtypes,
          severities: options.severities,
          statuses: options.statuses,
          firStages: options.firStages,
          complaintModes: options.complaintModes,
          beats: options.beats,
          villages: options.villages
        }
      });
    }

    if (req.method === "GET" && path.endsWith("/crimes")) {
      const crimes = await getAllCrimes(req);
      const filtered = filterCrimes(crimes, Object.fromEntries(url.searchParams.entries()));
      const result = paginateCrimes(filtered, Object.fromEntries(url.searchParams.entries()));
      return send(res, 200, { success: true, ...result });
    }

    if (req.method === "POST" && path.endsWith("/crimes")) {
      const body = await readJsonBody(req);
      const normalized = normalizeApiRecord(body);
      normalized.crime_date = normalized.crime_date || buildDate(normalized.fir_year, normalized.fir_month, normalized.fir_day);
      normalized.crime_id = normalized.crime_id || generatedCrimeId(normalized, Date.now());
      const validationErrors = validateApiRecord(normalized);
      if (validationErrors.length > 0) {
        return send(res, 400, { message: validationErrors.join(", ") });
      }

      const inserted = await getTable(req).insertRow(normalized);
      return send(res, 201, { data: inserted });
    }

    if (req.method === "POST" && path.endsWith("/crimes/upload-session/start")) {
      const body = await readJsonBody(req);
      if (body.import_mode === "replace" && body.confirm_replace !== true) return send(res, 400, { success: false, message: "Confirm replacement before clearing existing CrimeRecords." });
      if (body.import_mode === "new_dataset" && !DATASET_METADATA_COLUMNS) return send(res, 400, { success: false, message: "Create new dataset requires dataset_id, dataset_name, upload_id, source_file_name, and imported_at columns. Add them in Catalyst and set DATASET_METADATA_COLUMNS=true." });
      const session = createSession(body);
      return send(res, 201, { success: true, upload_id: session.upload_id, dataset_id: session.dataset_id, started_at: session.started_at, batch_size: UPLOAD_BATCH_SIZE, data: { upload_id: session.upload_id, dataset_id: session.dataset_id, started_at: session.started_at, batch_size: UPLOAD_BATCH_SIZE } });
    }

    if (req.method === "POST" && path.endsWith("/crimes/upload-batch")) {
      const body = await readJsonBody(req);
      const rows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.records) ? body.records : [];
      const session = uploadSessions.get(body.upload_id);
      if (!session) return send(res, 404, { success: false, message: "Upload session not found or expired. Start a new upload session." });
      if (!rows.length) return send(res, 400, { success: false, message: "Upload batch contains no rows." });
      if (rows.length > 200) return send(res, 400, { success: false, message: "Upload batch exceeds the maximum 200 rows. Reduce the batch size and retry." });
      const detected = detectMapping(Object.keys(rows[0] || {}));
      const mergedMapping = { ...detected.mapping, ...(body.mapping || {}) };
      const minimumSatisfied = (mergedMapping.district || mergedMapping.police_station) && (mergedMapping.crime_type || mergedMapping.crime_subtype) && (mergedMapping.fir_year || mergedMapping.crime_date);
      if (!minimumSatisfied) {
        return send(res, 400, { success: false, message: "This CSV does not look like a crime records dataset.", missingMinimum: detected.missingMinimum, mapping: mergedMapping });
      }
      const result = await processUploadRows(req, session, rows, mergedMapping, body.upload_mode || body.duplicate_mode || "skip_duplicates", body.batch_index || 1);
      const totals = await finalizeSessionSummary(req, session);
      return send(res, 200, { success: true, batch_index: body.batch_index || 1, received_rows: rows.length, inserted_rows: totals.insertedRows, failed_rows: totals.errorRows, skipped_duplicates: totals.skippedDuplicates, cleared_existing_records: session.cleared_existing_records, errors: totals.validationErrors.slice(-20), data: { upload_id: session.upload_id, batch_index: body.batch_index || 1, total_batches: body.total_batches || 0, cleared_existing_records: session.cleared_existing_records, ...result, totals } });
    }

    if (req.method === "POST" && path.endsWith("/crimes/upload-session/finish")) {
      const body = await readJsonBody(req);
      const session = uploadSessions.get(body.upload_id);
      if (!session) return send(res, 404, { success: false, message: "Upload session not found or expired." });
      const result = await finalizeSessionSummary(req, session);
      uploadSessions.delete(body.upload_id);
      await invalidateAnalyticsCache(req, "upload-session-finish");
      return send(res, 200, { success: true, data: result, ...result });
    }

    if (req.method === "PUT" && crimeRowMatch) {
      const body = await readJsonBody(req);
      const normalized = normalizeApiRecord(body);
      normalized.ROWID = crimeRowMatch[1];
      normalized.crime_date = normalized.crime_date || buildDate(normalized.fir_year, normalized.fir_month, normalized.fir_day);
      const validationErrors = validateApiRecord(normalized);
      if (validationErrors.length > 0) {
        return send(res, 400, { message: validationErrors.join(", ") });
      }

      const updated = await getTable(req).updateRow(normalized);
      return send(res, 200, { data: updated });
    }

    if (req.method === "DELETE" && crimeRowMatch) {
      await getTable(req).deleteRow(crimeRowMatch[1]);
      return send(res, 200, { data: { deleted: true, ROWID: crimeRowMatch[1] } });
    }

    if (req.method === "POST" && path.endsWith("/crimes/upload-csv")) {
      const result = await uploadCsv(req);
      if (result.validRows > 0 && result.insertedRows === 0) {
        return send(res, 500, {
          success: false,
          message: "Upload parsed successfully, but Data Store insert failed.",
          error: result.batchErrors.join(" | ") || "No rows were inserted.",
          details: result.batchErrors.join(" | ") || "No rows were inserted.",
          samplePayloadKeys: result.samplePayloadKeys,
          samplePayload: result.samplePayload,
          suggestion: "Verify CrimeRecords table has exactly the allowed columns.",
          data: result,
          ...result
        });
      }
      return send(res, 200, { data: result, ...result });
    }

    if (req.method === "GET" && path.endsWith("/crimes/filter")) {
      const crimes = await getAllCrimes(req);
      const filtered = filterCrimes(crimes, Object.fromEntries(url.searchParams.entries()));
      const result = paginateCrimes(filtered, Object.fromEntries(url.searchParams.entries()));
      return send(res, 200, {
        success: true,
        ...result
      });
    }

    if (req.method === "GET" && crimeRowMatch) {
      const crimes = await getAllCrimes(req);
      const record = crimes.find((crime) => String(crime.ROWID) === decodeURIComponent(crimeRowMatch[1])) || null;
      if (!record) return send(res, 404, { success: false, message: "Crime record not found", ROWID: decodeURIComponent(crimeRowMatch[1]) });
      return send(res, 200, { success: true, data: record });
    }

    return send(res, 404, {
      success: false,
      message: "Route not found",
      method: req.method,
      path,
      availableRoutes: [
        "GET /",
        "GET /health",
        "GET /crimes",
        "GET /crimes/count",
        "GET /crimes/filter",
        "GET /crimes/filters",
        "GET /crimes/debug/mapping",
        "GET /crimes/schema-check",
        "GET /crimes/:ROWID",
        "POST /crimes/upload-session/start",
        "POST /crimes/upload-batch",
        "POST /crimes/upload-session/finish",
        "POST /crimes/upload-csv",
        "POST /crimes"
      ]
    });
  } catch (error) {
    console.error("[crime-api] request failed", error);
    return send(res, 500, {
      success: false,
      message: "Crime API failed",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};
