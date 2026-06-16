const fs = require("fs");
const { parse } = require("csv-parse");
const { formidable } = require("formidable");
const catalyst = require("zcatalyst-sdk-node");
const { fetchCrimeRecords, filterOptions } = require("./crimeAnalytics");

// Configure CRIME_RECORDS_TABLE in Catalyst Function environment variables if
// your Catalyst Data Store requires a table ID or a table name different from CrimeRecords.
const CRIME_RECORDS_TABLE = process.env.CRIME_RECORDS_TABLE || process.env.CRIME_TABLE || "CrimeRecords";
const BATCH_SIZE = Number(process.env.CSV_INSERT_BATCH_SIZE || 200);

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
];
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
  "GET /crimes/filter",
  "GET /crimes/filters",
  "GET /crimes/debug/mapping",
  "GET /crimes/schema-check",
  "GET /crimes/:ROWID",
  "POST /crimes",
  "PUT /crimes/:ROWID",
  "DELETE /crimes/:ROWID",
  "POST /crimes/upload-csv"
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
  created_time: row.created_time
});

const getAllCrimes = async (req) => {
  try {
    return await fetchCrimeRecords(getApp(req), { limit: 5000 });
  } catch (error) {
    console.error("[crime-api] shared fetch failed, falling back to getAllRows", error);
    const rows = await getTable(req).getAllRows();
    return rows.map(toClientRecord);
  }
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
  fir_stage: activeValue(params.fir_stage) ? String(params.fir_stage) : activeValue(params.status) ? String(params.status) : ""
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
      const missing = REQUIRED_CSV_COLUMNS.filter((column) => !Object.prototype.hasOwnProperty.call(row, column));
      if (missing.length > 0) {
        validationErrors.push(`Missing required columns: ${missing.join(", ")}`);
        skippedRows = totalRows;
        break;
      }
    }

    const rowErrors = validateCsvRow(row);
    if (rowErrors.length > 0) {
      errorRows += 1;
      skippedRows += 1;
      if (validationErrors.length < 100) {
        validationErrors.push(`Row ${totalRows + 1}: ${rowErrors.join(", ")}`);
      }
      continue;
    }

    const transformedRecord = transformCsvRowToCrimeRecord(row, totalRows);
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
        note: "Only allowed fields are inserted into Catalyst."
      });
    }

    if (req.method === "GET" && path.endsWith("/crimes/schema-check")) {
      return send(res, 200, {
        success: true,
        table: CRIME_RECORDS_TABLE,
        allowedFields: ALLOWED_CRIME_RECORD_FIELDS,
        systemColumnsNotInserted: ["ROWID", "CREATORID", "CREATEDTIME", "MODIFIEDTIME"],
        message: "Verify these columns exist in Catalyst Data Store table CrimeRecords."
      });
    }

    if (req.method === "GET" && path.endsWith("/crimes/count")) {
      const totalRecords = await getStoredCount(req);
      return send(res, 200, { data: { totalRecords }, totalRecords });
    }

    if (req.method === "GET" && path.endsWith("/crimes/filters")) {
      const crimes = await getAllCrimes(req);
      const options = filterOptions(crimes);
      return send(res, 200, {
        success: true,
        data: {
          fir_year: options.fir_year,
          fir_month: options.fir_month,
          district: options.district,
          police_station: options.police_station,
          crime_type: options.crime_type,
          severity: options.severity,
          fir_stage: options.fir_stage,
          years: options.years,
          months: options.months,
          districts: options.districts,
          policeStations: options.policeStations,
          crimeTypes: options.crimeTypes,
          severities: options.severities,
          statuses: options.statuses
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
