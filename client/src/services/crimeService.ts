import type { ApiResponse, CrimeCount, CrimeDataset, CrimeRecord, CrimeRecordFilterOptions, CrimeRecordQuery, UploadSummary } from "../types/crime";
import Papa from "papaparse";

export interface CrimeFilters {
  district?: string;
  police_station?: string;
  crime_type?: string;
  severity?: string;
  status?: string;
}

const shouldSend = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "all";
};

const queryString = (query: CrimeRecordQuery = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (shouldSend(value)) params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

const crimeApiBase = import.meta.env.VITE_CRIME_API_BASE || "/server/crime-api";
const catalystNotMountedMessage =
  "Catalyst Functions are not connected in this preview. Run `catalyst serve` from the project root so uploads can be inserted into the Catalyst Data Store.";

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(catalystNotMountedMessage);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const crimeService = {
  async checkCrimeApiConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${crimeApiBase}/crimes`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      const contentType = response.headers.get("content-type") || "";
      return response.ok && contentType.includes("application/json");
    } catch {
      return false;
    }
  },

  uploadCrimeCSV(file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<UploadSummary>> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${crimeApiBase}/crimes/upload-csv`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        const contentType = xhr.getResponseHeader("content-type") || "";
        if (!contentType.includes("application/json")) {
          reject(new Error(catalystNotMountedMessage));
          return;
        }

        try {
          const body = JSON.parse(xhr.responseText || "{}") as ApiResponse<UploadSummary> & {
            message?: string;
            error?: string;
            details?: string;
            samplePayloadKeys?: string[];
            suggestion?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve(body);
            return;
          }
          const batchDetails = body.data?.batchErrors?.length ? body.data.batchErrors.join(" | ") : "";
          const backendDetails = [
            body.message,
            body.error,
            body.details,
            batchDetails,
            body.samplePayloadKeys?.length
              ? `Insert payload keys: ${body.samplePayloadKeys.join(", ")}`
              : "",
            body.suggestion
          ].filter(Boolean).join(" ");
          reject(new Error(backendDetails || "CSV upload failed"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(catalystNotMountedMessage));
        }
      };

      xhr.onerror = () => reject(new Error("Unable to reach Catalyst crime-api function."));
      xhr.send(formData);
    });
  },

  async startUploadSession(payload: { import_mode: "append" | "replace" | "new_dataset"; dataset_name: string; source_file_name: string; confirm_replace?: boolean }) {
    return request<ApiResponse<{ upload_id: string; dataset_id: string; started_at: string; batch_size: number }>>(`${crimeApiBase}/crimes/upload-session/start`, { method: "POST", body: JSON.stringify(payload) });
  },

  async uploadCrimeBatch(payload: { upload_id: string; import_mode: "append" | "replace" | "new_dataset"; rows: Record<string, string>[]; mapping: Record<string, string>; batch_index: number; total_batches: number; upload_mode: "insert_new" | "skip_duplicates" | "replace" }) {
    return request<ApiResponse<{ totals: UploadSummary }>>(`${crimeApiBase}/crimes/upload-batch`, { method: "POST", body: JSON.stringify(payload) });
  },

  async finishUploadSession(uploadId: string) {
    return request<ApiResponse<UploadSummary>>(`${crimeApiBase}/crimes/upload-session/finish`, { method: "POST", body: JSON.stringify({ upload_id: uploadId }) });
  },

  async clearAllCrimeRecords() {
    return request<ApiResponse<{ deleted_rows: number; totalRecords: number; message: string }>>(`${crimeApiBase}/crimes/clear-all`, { method: "POST", body: JSON.stringify({ confirmation: "RESET" }) });
  },

  async clearCrimeRecordsBatch(batchSize = 200) {
    return request<ApiResponse<{ deleted_rows: number; remaining_records: number; done: boolean }>>(`${crimeApiBase}/crimes/clear-batch`, { method: "POST", body: JSON.stringify({ confirmation: "RESET", batch_size: batchSize }) });
  },

  async uploadCrimeCSVInBatches(file: File, mapping: Record<string, string>, uploadMode: "insert_new" | "skip_duplicates" | "replace", options: { importLimit: number | null; signal?: AbortSignal; importMode: "append" | "replace" | "new_dataset"; datasetName: string; confirmReplace?: boolean; onProgress?: (state: { phase: "Starting" | "Parsing" | "Uploading" | "Finishing"; parsedRows: number; uploadedBatches: number; insertedRows: number; failedRows: number; skippedDuplicates: number }) => void }) {
    console.log("Starting CSV import", { fileName: file.name, importMode: options.importMode, demoImportLimit: options.importLimit });
    options.onProgress?.({ phase: "Starting", parsedRows: 0, uploadedBatches: 0, insertedRows: 0, failedRows: 0, skippedDuplicates: 0 });
    const sessionResponse = await this.startUploadSession({ import_mode: options.importMode, dataset_name: options.datasetName, source_file_name: file.name, confirm_replace: options.confirmReplace });
    const uploadId = sessionResponse.data.upload_id;
    const batchSize = Math.max(50, Math.min(sessionResponse.data.batch_size || 100, 200));
    let parsedRows = 0;
    let uploadedBatches = 0;
    let insertedRows = 0;
    let failedRows = 0;
    let skippedDuplicates = 0;
    let pending: Record<string, string>[] = [];
    let batchIndex = 0;

    const notify = (phase: "Starting" | "Parsing" | "Uploading" | "Finishing") => options.onProgress?.({ phase, parsedRows, uploadedBatches, insertedRows, failedRows, skippedDuplicates });
    const timed = async <T,>(operation: Promise<T>) => {
      let timeout: number | undefined;
      try {
        return await Promise.race<T>([
          operation,
          new Promise<T>((_, reject) => { timeout = window.setTimeout(() => reject(new Error("Batch upload timed out. You can retry from this batch.")), 60000); })
        ]);
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }
    };

    const sendBatch = async (rows: Record<string, string>[]) => {
      if (!rows.length) return;
      if (options.signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
      batchIndex += 1;
      console.log("Uploading batch", batchIndex, rows.length);
      notify("Uploading");
      const response = await timed(this.uploadCrimeBatch({ upload_id: uploadId, import_mode: options.importMode, rows, mapping, batch_index: batchIndex, total_batches: 0, upload_mode: uploadMode }));
      console.log("Batch upload response", response);
      uploadedBatches += 1;
      insertedRows = response.data.totals.insertedRows;
      failedRows = response.data.totals.errorRows;
      skippedDuplicates = response.data.totals.skippedDuplicates || 0;
      notify("Uploading");
    };

    const parseFile = (worker: boolean) => new Promise<void>((resolve, reject) => {
      let settled = false;
      let receivedChunk = false;
      let parserInstance: { abort: () => void } | null = null;
      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(startWatchdog);
        options.signal?.removeEventListener("abort", onAbort);
        callback();
      };
      const abortWithError = (error: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(startWatchdog);
        options.signal?.removeEventListener("abort", onAbort);
        parserInstance?.abort();
        reject(error);
      };
      const onAbort = () => {
        abortWithError(new DOMException("Import cancelled", "AbortError"));
      };
      const startWatchdog = window.setTimeout(() => {
        if (receivedChunk) return;
        abortWithError(new Error("CSV parsing did not start. Please retry or disable worker mode."));
      }, 3000);

      options.signal?.addEventListener("abort", onAbort, { once: true });
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        worker,
        chunkSize: 512 * 1024,
        chunk: (result, parser) => {
          receivedChunk = true;
          parserInstance = parser;
          console.log("PapaParse chunk received", result.data.length, { worker });
          parser.pause();
          (async () => {
            for (const row of result.data) {
              if (options.signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
              if (options.importLimit !== null && parsedRows >= options.importLimit) {
                parser.abort();
                settle(resolve);
                return;
              }
              pending.push(row);
              parsedRows += 1;
              if (pending.length >= batchSize) await sendBatch(pending.splice(0, batchSize));
            }
            notify("Parsing");
            parser.resume();
          })().catch((error) => {
            parser.abort();
            settle(() => reject(error));
          });
        },
        complete: () => settle(resolve),
        error: (error) => settle(() => reject(error))
      });
    });

    try {
      try {
        await parseFile(true);
      } catch (error) {
        const noWorkerProgress = parsedRows === 0 && error instanceof Error && error.message.includes("CSV parsing did not start");
        if (!noWorkerProgress || options.signal?.aborted) throw error;
        console.warn("[crime-api client] PapaParse worker did not start; retrying without worker", error);
        await parseFile(false);
      }
      if (options.signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
      await sendBatch(pending);
      notify("Finishing");
      return await this.finishUploadSession(uploadId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        notify("Finishing");
        return this.finishUploadSession(uploadId);
      }
      throw error;
    }
  },

  getCrimeRecords() {
    return request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes`);
  },

  getCrimeRecordsPage(query?: CrimeRecordQuery) {
    return request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes${queryString(query)}`);
  },

  getCrimeCount() {
    return request<ApiResponse<CrimeCount>>(`${crimeApiBase}/crimes/count`);
  },

  getDatasets() {
    return request<ApiResponse<CrimeDataset[]>>(`${crimeApiBase}/datasets`);
  },

  deleteDataset(datasetId: string) {
    return request<ApiResponse<{ deleted_records: number }>>(`${crimeApiBase}/datasets/${encodeURIComponent(datasetId)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" })
    });
  },

  getCrimeRecordFilters() {
    return request<ApiResponse<CrimeRecordFilterOptions>>(`${crimeApiBase}/crimes/filters`);
  },

  getCrimeRecordByRowId(rowId: string) {
    return request<ApiResponse<CrimeRecord>>(`${crimeApiBase}/crimes/${encodeURIComponent(rowId)}`);
  },

  getFilteredCrimeRecords(filters: CrimeFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes/filter?${params.toString()}`);
  },

  createCrimeRecord(record: CrimeRecord) {
    return request<ApiResponse<CrimeRecord>>(`${crimeApiBase}/crimes`, {
      method: "POST",
      body: JSON.stringify(record)
    });
  }
};
