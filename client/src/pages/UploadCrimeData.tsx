import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { ArrowDown, CheckCircle2, CircleHelp, Download, FileSpreadsheet, FileUp, Loader2, RotateCcw, ShieldAlert, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS } from "../auth/permissions";
import StateBlock from "../components/StateBlock";
import { RecommendedNextStep } from "../components/ModuleGuide";
import { crimeService } from "../services/crimeService";
import { dashboardService } from "../services/dashboardService";
import type { CrimeDataset, CsvPreview, UploadSummary } from "../types/crime";
import { crimeCsvColumns, sampleCrimeCsv } from "../utils/crimeCsvConfig";
import { analyzeFlexibleCsv, buildFlexibleCsvPreview, canonicalCrimeFields } from "../utils/csvMapping";

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadSampleCsv = () => {
  const blob = new Blob([sampleCrimeCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "crimepulse-sample-crime-data.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const downloadFailedRows = (summary: UploadSummary) => {
  const rows = summary.failedRowDetails || [];
  const content = ["row,errors", ...rows.map((item) => `${item.row || ""},"${(item.errors || [item.error || "Unknown error"]).join("; ").replace(/"/g, '""')}"`)].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "failed_rows.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const getTotalRecords = (response: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  response.totalRecords ?? response.data?.totalRecords ?? 0;

const crimeApiBase = import.meta.env.VITE_CRIME_API_BASE || "/server/crime-api";

const parseCsvForImport = (selectedFile: File) => new Promise<Record<string, string>[]>((resolve, reject) => {
  Papa.parse<Record<string, string>>(selectedFile, {
    header: true,
    skipEmptyLines: true,
    worker: false,
    complete: (results) => resolve(results.data),
    error: (error) => reject(error)
  });
});

const readJsonResponse = async <T,>(response: Response): Promise<T> => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body as { success?: boolean }).success === false) {
    const failure = body as { message?: string; error?: string; details?: string };
    throw new Error(failure.message || failure.error || failure.details || `Upload request failed with status ${response.status}`);
  }
  return body as T;
};

const fetchJsonWithTimeout = async <T,>(endpoint: string, init: RequestInit, label: string, timeoutMs = 60000): Promise<T> => {
  const requestController = new AbortController();
  const parentSignal = init.signal;
  const timeout = window.setTimeout(() => requestController.abort(), timeoutMs);
  const abortFromParent = () => requestController.abort();
  if (parentSignal) {
    if (parentSignal.aborted) requestController.abort();
    else parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    const response = await fetch(endpoint, { ...init, signal: requestController.signal });
    return await readJsonResponse<T>(response);
  } catch (error) {
    if (requestController.signal.aborted && !(parentSignal?.aborted)) {
      throw new Error(`Import timed out while ${label}. Please try again.`);
    }
    console.error(`[IMPORT] ${label} failed`, { endpoint, error });
    throw error;
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
};

const UploadCrimeData = () => {
  const { currentUser, hasPermission } = useAuth();
  const canReplaceDataset = hasPermission(PERMISSIONS.REPLACE_DATASET);
  const canDeleteDataset = hasPermission(PERMISSIONS.DELETE_DATASET);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const validationRef = useRef<HTMLElement | null>(null);
  const importPanelRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<AbortController | null>(null);
  const resetCancelledRef = useRef(false);
  const parsingWatchdogTriggeredRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [crimeApiConnected, setCrimeApiConnected] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [existingRecordCount, setExistingRecordCount] = useState<number | null>(null);
  const [quotaLimitReached, setQuotaLimitReached] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsingRows, setParsingRows] = useState(0);
  const [uploadMode, setUploadMode] = useState<"insert_new" | "skip_duplicates" | "replace">("skip_duplicates");
  const [uploadState, setUploadState] = useState({ uploadedBatches: 0, insertedRows: 0, failedRows: 0 });
  const mappingIsUsable = Boolean((mapping.district || mapping.police_station) && (mapping.crime_type || mapping.crime_subtype) && (mapping.fir_year || mapping.crime_date));
  const [importLimit, setImportLimit] = useState<number | null>(10000);
  const [importPhase, setImportPhase] = useState<"Idle" | "Validating" | "Starting" | "Parsing" | "Clearing" | "Uploading" | "Finishing" | "Complete" | "Error" | "Cancelled">("Idle");
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [clearDeletedRows, setClearDeletedRows] = useState(0);
  const [clearRemainingRows, setClearRemainingRows] = useState<number | null>(null);
  const [clearBatchNumber, setClearBatchNumber] = useState(0);
  const [skippedDuplicates, setSkippedDuplicates] = useState(0);
  const [importMode, setImportMode] = useState<"append" | "replace" | "new_dataset">("replace");
  const [datasetName, setDatasetName] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [datasets, setDatasets] = useState<CrimeDataset[]>([]);
  const [datasetMessage, setDatasetMessage] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetDeletedRows, setResetDeletedRows] = useState(0);
  const [resetRemainingRows, setResetRemainingRows] = useState<number | null>(null);
  const [resetBatchNumber, setResetBatchNumber] = useState(0);
  const [resetStatusMessage, setResetStatusMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const totalRowsDetected = preview?.analysis?.totalRows || 0;
  const importTargetRows = importLimit === null ? totalRowsDetected : Math.min(totalRowsDetected, importLimit);
  const totalBatchesEstimate = Math.ceil(importTargetRows / 100);
  const validationReady = Boolean(preview?.analysis && preview.detectedMapping?.validDataset && mappingIsUsable);
  const mappedColumns = Object.values(mapping).filter(Boolean).length;
  const wizardStep = summary?.storageVerified ? 4 : uploading ? 3 : validationReady ? 3 : file ? 2 : 1;
  const phaseLabel = {
    Idle: "Ready",
    Validating: "Validating import",
    Starting: "Starting upload session",
    Parsing: "Parsing file",
    Clearing: "Clearing existing records",
    Uploading: "Uploading records in safe batches",
    Finishing: "Finalizing stored records",
    Complete: "Import complete",
    Error: "Import failed",
    Cancelled: "Import cancelled"
  }[importPhase];

  const catalystConnectionMessage =
    "Catalyst Functions are not connected on this local preview. Start the app with `catalyst serve` from the `kavach-analytics` folder, then upload again so rows are inserted into the Catalyst Data Store.";

  const checkConnection = async () => {
    const connected = await crimeService.checkCrimeApiConnection();
    setCrimeApiConnected(connected);
    setConnectionChecked(true);
    if (connected) {
      try {
        const countResponse = await crimeService.getCrimeCount();
        setExistingRecordCount(getTotalRecords(countResponse));
        const datasetResponse = await crimeService.getDatasets();
        setDatasets(datasetResponse.data || []);
        setDatasetMessage((datasetResponse as { message?: string }).message || "");
      } catch {
        setExistingRecordCount(null);
      }
    }
    return connected;
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (!uploading || (importPhase !== "Starting" && importPhase !== "Parsing") || parsingRows > 0) return undefined;
    const watchdog = window.setTimeout(() => {
      parsingWatchdogTriggeredRef.current = true;
      cancelRef.current?.abort();
      setImportPhase("Error");
      setError("CSV parsing did not start. Please choose the file again and retry.");
      setUploading(false);
    }, 10000);
    return () => window.clearTimeout(watchdog);
  }, [uploading, importPhase, parsingRows]);

  useEffect(() => {
    if (!validationReady || loadingPreview) return;
    window.setTimeout(() => validationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    window.setTimeout(() => importPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
  }, [validationReady, loadingPreview]);

  useEffect(() => {
    if (uploading) window.setTimeout(() => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }, [uploading, importPhase]);

  useEffect(() => {
    if (summary?.storageVerified) window.setTimeout(() => successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [summary?.storageVerified]);

  const resetResultState = () => {
    setError("");
    setSummary(null);
    setUploadProgress(0);
    setQuotaLimitReached(false);
    setImportPhase("Idle");
    setImportStatusMessage("");
    setUploadState({ uploadedBatches: 0, insertedRows: 0, failedRows: 0 });
    setClearDeletedRows(0);
    setClearRemainingRows(null);
    setClearBatchNumber(0);
    setSkippedDuplicates(0);
  };

  const clearExistingRecordsForReplace = async (controller: AbortController) => {
    setImportPhase("Clearing");
    setImportStatusMessage("Clearing existing records...");
    setClearDeletedRows(0);
    setClearRemainingRows(existingRecordCount ?? null);
    setClearBatchNumber(0);
    console.log("[IMPORT] Clearing existing records...");

    let done = false;
    let deletedTotal = 0;
    let batchNumber = 0;
    while (!done) {
      if (controller.signal.aborted) throw new DOMException("Import cancelled", "AbortError");
      batchNumber += 1;
      setClearBatchNumber(batchNumber);
      const result = await fetchJsonWithTimeout<{
        success: boolean;
        deleted_rows?: number;
        remaining_records?: number;
        deleted?: number;
        remaining?: number;
        done?: boolean;
        data?: { deleted_rows?: number; remaining_records?: number; deleted?: number; remaining?: number; done?: boolean };
      }>(
        `${crimeApiBase}/crimes/clear-batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ confirmation: "RESET", batch_size: 200 })
        },
        "clearing existing records"
      );
      const deleted = Number(result.deleted_rows ?? result.deleted ?? result.data?.deleted_rows ?? result.data?.deleted ?? 0);
      const remaining = Number(result.remaining_records ?? result.remaining ?? result.data?.remaining_records ?? result.data?.remaining ?? 0);
      deletedTotal += deleted;
      done = Boolean(result.done ?? result.data?.done ?? remaining === 0);
      setClearDeletedRows(deletedTotal);
      setClearRemainingRows(remaining);
      setImportStatusMessage(`Clearing old records... ${remaining.toLocaleString()} remaining`);
      console.log("[IMPORT] Clear batch complete", { batchNumber, deleted, deletedTotal, remaining, done, result });
      if (deleted === 0 && !done) throw new Error("Clear batch made no progress. Please retry the import.");
    }
    setImportStatusMessage("Existing records cleared. Starting batch upload...");
    console.log("[IMPORT] Clearing complete", { deletedTotal });
  };

  const prepareFile = async (selectedFile: File | null) => {
    resetResultState();
    setPreview(null);
    setMapping({});
    setParsingRows(0);
    setImportMode("replace");
    setConfirmReplace(false);
    setFile(selectedFile);

    if (!selectedFile) return;

    setDatasetName(selectedFile.name.replace(/\.csv$/i, "") || "Crime dataset");

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Select a valid CSV file.");
      return;
    }

    try {
      setLoadingPreview(true);
      const nextPreview = await buildFlexibleCsvPreview(selectedFile);
      setPreview(nextPreview);
      setMapping(nextPreview.detectedMapping?.mapping || {});
      const analysis = await analyzeFlexibleCsv(selectedFile, nextPreview.detectedMapping?.mapping || {}, setParsingRows);
      setPreview({ ...nextPreview, analysis });
    } catch {
      setError("Unable to preview CSV. Check that the file is a valid comma-separated file.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    prepareFile(event.target.files?.[0] || null);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    prepareFile(event.dataTransfer.files?.[0] || null);
  };

  const importCsv = async () => {
    if (!file) {
      setError("No CSV file selected. Please choose a file again.");
      return;
    }

    if (!preview?.detectedMapping?.validDataset) {
      setError(`This CSV does not look like a crime records dataset. Missing: ${preview?.detectedMapping?.missingMinimum.join(", ") || "minimum crime fields"}`);
      return;
    }
    if (importMode === "replace" && !confirmReplace) {
      setError("Confirm that existing CrimeRecords data will be removed before using Replace existing records.");
      return;
    }
    if (importMode === "replace" && !canReplaceDataset) {
      setError("Your current role does not have permission to replace existing datasets.");
      return;
    }

    try {
      setUploading(true);
      setImportPhase("Validating");
      setImportStatusMessage("Validating import settings...");
      setError("");
      setSummary(null);
      setUploadProgress(0);
      setParsingRows(0);
      setUploadState({ uploadedBatches: 0, insertedRows: 0, failedRows: 0 });
      setClearDeletedRows(0);
      setClearRemainingRows(null);
      setClearBatchNumber(0);
      setSkippedDuplicates(0);
      parsingWatchdogTriggeredRef.current = false;
      const controller = new AbortController();
      cancelRef.current = controller;
      console.log("[IMPORT] Selected import mode:", importMode);
      console.log("[IMPORT] Import started", { fileName: file.name, importMode, demoImportLimit: importLimit });
      setImportPhase("Parsing");
      setImportStatusMessage("Parsing CSV rows...");
      const allRows = await parseCsvForImport(file);
      if (controller.signal.aborted) throw new DOMException("Import cancelled", "AbortError");
      const rowsToImport = allRows.slice(0, importLimit ?? allRows.length);
      if (!rowsToImport.length) throw new Error("The selected CSV has no importable data rows.");
      console.log("[IMPORT] Parsed rows:", rowsToImport.length);
      setParsingRows(rowsToImport.length);

      const connected = await checkConnection();
      if (!connected) throw new Error(catalystConnectionMessage);

      if (importMode === "replace") {
        await clearExistingRecordsForReplace(controller);
      }

      setImportPhase("Starting");
      setImportStatusMessage("Starting Catalyst upload session...");
      console.log("[IMPORT] Starting upload session");
      const session = await fetchJsonWithTimeout<{ data?: { upload_id: string }; upload_id?: string }>(
        `${crimeApiBase}/crimes/upload-session/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ import_mode: importMode, dataset_name: datasetName || file.name.replace(/\.csv$/i, ""), source_file_name: file.name, confirm_replace: confirmReplace })
        },
        "starting upload session"
      );
      const uploadId = session.data?.upload_id || session.upload_id;
      if (!uploadId) throw new Error("Upload session did not return an upload ID.");

      const batchSize = 100;
      const totalBatches = Math.ceil(rowsToImport.length / batchSize);
      console.log("[IMPORT] Total batches:", totalBatches);
      setImportPhase("Uploading");
      for (let offset = 0; offset < rowsToImport.length; offset += batchSize) {
        if (controller.signal.aborted) throw new DOMException("Import cancelled", "AbortError");
        const batchIndex = Math.floor(offset / batchSize) + 1;
        const batch = rowsToImport.slice(offset, offset + batchSize);
        setUploadState((current) => ({ ...current, uploadedBatches: batchIndex }));
        setImportStatusMessage(`Uploading batch ${batchIndex} of ${totalBatches}`);
        console.log("[IMPORT] Uploading batch", batchIndex, "of", totalBatches, { rows: batch.length });
        const batchResult = await fetchJsonWithTimeout<{ inserted_rows?: number; failed_rows?: number; skipped_duplicates?: number }>(
          `${crimeApiBase}/crimes/upload-batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ upload_id: uploadId, import_mode: importMode, duplicate_mode: uploadMode, upload_mode: uploadMode, batch_index: batchIndex, total_batches: totalBatches, rows: batch, records: batch, mapping, is_first_batch: batchIndex === 1 })
          },
          `uploading batch ${batchIndex} of ${totalBatches}`
        );
        console.log("[IMPORT] Batch upload response", { batchIndex, batchResult });
        setUploadState({ uploadedBatches: batchIndex, insertedRows: Number(batchResult.inserted_rows || 0), failedRows: Number(batchResult.failed_rows || 0) });
        setSkippedDuplicates(Number(batchResult.skipped_duplicates || 0));
        setUploadProgress(Math.round((batchIndex / totalBatches) * 100));
      }
      setImportPhase("Finishing");
      setImportStatusMessage("Finalizing import and verifying storage...");
      const finish = await fetchJsonWithTimeout<{ data?: UploadSummary } & UploadSummary>(
        `${crimeApiBase}/crimes/upload-session/finish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ upload_id: uploadId }) },
        "finishing upload session"
      );
      const response = { data: finish.data || finish };
      setUploadProgress(100);
      setImportPhase("Complete");
      setImportStatusMessage("Import complete. Refreshing analytics cache...");
      setSummary(response.data);
      try {
        await dashboardService.rebuildAnalytics();
        setImportStatusMessage("Import complete. Analytics cache refreshed.");
      } catch (cacheError) {
        console.warn("[Upload] Analytics cache rebuild failed; pages will rebuild on demand.", cacheError);
        setImportStatusMessage("Import complete. Analytics will refresh on demand.");
      }
      window.dispatchEvent(new Event("crimepulse:dataset-updated"));
      void checkConnection();
      if (!response.data.success || !response.data.storageVerified || response.data.insertedRows === 0) {
        setImportPhase("Error");
        setError(
          `Upload parsed successfully, but Data Store insert failed: ${
            response.data.batchErrors?.join(" | ") || "storage verification did not confirm inserted records"
          }`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV upload failed";
      if (err instanceof DOMException && err.name === "AbortError") {
        if (parsingWatchdogTriggeredRef.current) {
          setImportPhase("Error");
          setError("CSV parsing did not start. Please choose the file again and retry.");
          return;
        }
        setImportPhase("Cancelled");
        setImportStatusMessage("Import cancelled.");
        setError("Import cancelled. Rows already inserted remain available for analytics.");
        return;
      }
      if (message.includes("FREE_USAGE_LIMIT_REACHED")) {
        setImportPhase("Error");
        setImportStatusMessage("Import failed.");
        setQuotaLimitReached(true);
        setError(
          "Catalyst free Data Store insert limit has been reached. Existing records are still available for analytics. Go to Dashboard instead of uploading again."
        );
      } else {
        setImportPhase("Error");
        setImportStatusMessage("Import failed.");
        setError(message);
      }
    } finally {
      setUploading(false);
      cancelRef.current = null;
    }
  };

  const cancelImport = () => {
    setImportPhase("Cancelled");
    cancelRef.current?.abort();
  };

  const deleteDataset = async (dataset: CrimeDataset) => {
    if (!window.confirm(`Delete ${dataset.record_count.toLocaleString()} records in dataset \"${dataset.dataset_name}\"?`)) return;
    try {
      await crimeService.deleteDataset(dataset.dataset_id);
      await checkConnection();
      window.dispatchEvent(new Event("crimepulse:dataset-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete dataset.");
    }
  };

  const resetDemoData = async () => {
    if (!resetConfirmed || resetText !== "RESET") return;
    const initialCount = existingRecordCount ?? 0;
    try {
      setResetting(true);
      setError("");
      setResetError("");
      setResetDeletedRows(0);
      setResetRemainingRows(initialCount);
      setResetBatchNumber(0);
      setResetStatusMessage("Resetting records in safe batches...");
      resetCancelledRef.current = false;

      let deleted = 0;
      let remaining = initialCount;
      let batch = 0;
      while (!resetCancelledRef.current) {
        batch += 1;
        setResetBatchNumber(batch);
        setResetStatusMessage(`Deleting batch ${batch}...`);
        let timeout: number | undefined;
        const response = await Promise.race([
          crimeService.clearCrimeRecordsBatch(200),
          new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error("Batch delete timed out.")), 30000); })
        ]);
        if (timeout) window.clearTimeout(timeout);
        const result = response.data ?? response;
        deleted += Number(result.deleted_rows || 0);
        remaining = Number(result.remaining_records || 0);
        setResetDeletedRows(deleted);
        setResetRemainingRows(remaining);
        setResetStatusMessage(result.done ? "Finalizing reset..." : `Deleted batch ${batch}. Continuing...`);
        if (result.done) break;
      }

      if (resetCancelledRef.current) {
        setResetStatusMessage("Reset cancelled. Some records may already have been deleted.");
        setResetMessage("Reset cancelled. Some records may already have been deleted.");
        await checkConnection();
        window.dispatchEvent(new Event("crimepulse:dataset-updated"));
        return;
      }
      setExistingRecordCount(0);
      setDatasets([]);
      setFile(null);
      setPreview(null);
      setSummary(null);
      setMapping({});
      setResetOpen(false);
      setResetConfirmed(false);
      setResetText("");
      setResetMessage("Demo data reset successfully. Upload a CSV file to begin.");
      window.dispatchEvent(new Event("crimepulse:dataset-updated"));
      await checkConnection();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown batch delete error.";
      setResetError(`Reset failed during batch delete. Please retry. ${detail}`);
      setResetStatusMessage("Reset paused after a batch error.");
    } finally {
      setResetting(false);
    }
  };

  const cancelReset = () => {
    resetCancelledRef.current = true;
    setResetStatusMessage("Cancelling after the current batch finishes...");
  };

  if (!hasPermission(PERMISSIONS.UPLOAD_DATA)) {
    return <StateBlock title="Upload access is restricted" message="Only the Super Admin can upload, replace, reset, or manage shared CrimeRecords data." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Data Intake</p>
          <h1 className="text-3xl font-semibold text-white">Upload Crime Data</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Import crime-related CSV records into Catalyst Data Store. CrimePulse AI auto-detects common police, FIR, incident, and location column formats before streaming rows in safe batches.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={downloadSampleCsv} type="button"><Download className="h-4 w-4" />Download Sample CSV</button>
          {currentUser?.role === "super_admin" && <button className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-alert-critical/50 px-4 py-3 text-sm font-semibold text-alert-critical hover:bg-alert-critical/10" onClick={() => { setResetOpen(true); setResetError(""); setResetStatusMessage(""); setResetDeletedRows(0); setResetRemainingRows(existingRecordCount); setResetBatchNumber(0); }} type="button"><RotateCcw className="h-4 w-4" />Reset Demo Data</button>}
        </div>
      </div>

      <section className="card-safe border border-command-500/35 bg-command-500/5 p-5 shadow-glow">
        <div className="flex items-start gap-3"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-command-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">What this page does</p><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-300">This page imports FIR/crime CSV records into CrimePulse AI. After import, the system automatically generates dashboards, alerts, hotspot maps, trends, forecasts, and reports.</p></div></div>
      </section>

      <section className="card-safe border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Need help?</p><h2 className="mt-1 text-lg font-semibold text-white">Four steps to activate crime intelligence</h2></div><div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4"><span>1. Choose CSV</span><span>2. Keep Replace selected</span><span>3. Click Import Records</span><span>4. Open Dashboard</span></div></div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[1, "Choose CSV File"], [2, "Validate File"], [3, "Import Records"], [4, "Review Intelligence"]].map(([step, label]) => { const number = Number(step); const complete = number < wizardStep; const active = number === wizardStep; return <li key={number} className={`flex min-w-0 items-center gap-3 border p-3 ${active ? "border-command-300 bg-command-500/10" : complete ? "border-alert-low/40 bg-alert-low/5" : "border-command-700 bg-command-850/70 opacity-70"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-alert-low text-command-950" : active ? "bg-command-300 text-command-950" : "border border-command-700 text-slate-400"}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : number}</span><span className="min-w-0 text-sm font-semibold text-white">{label}</span></li>; })}</ol>
      </section>

      {(existingRecordCount ?? 0) === 0 && <section className="border border-command-300/40 bg-command-500/10 p-5 shadow-glow"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Fresh Demo Mode</p><h2 className="mt-2 text-lg font-semibold text-white">Fresh demo ready. Upload a CSV to begin analysis.</h2><p className="mt-2 text-sm text-slate-300">Start by uploading a crime CSV file. For demo, use Replace Existing Records to analyze a fresh CSV.</p></section>}
      {resetMessage && <section className="border border-alert-low/40 bg-alert-low/10 p-4 text-sm text-alert-low">{resetMessage}</section>}

      {connectionChecked && !crimeApiConnected && (
        <section className="rounded-md border border-alert-critical/50 bg-alert-critical/10 p-5 shadow-glow">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 text-alert-critical" />
            <div>
              <h2 className="text-base font-semibold text-alert-critical">Catalyst Data Store is not connected</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                You are viewing the React client on port 3000 without live Catalyst Functions. CSV preview will work, but upload cannot store records.
                Run <span className="font-semibold text-white">catalyst serve</span> from the project root and open the Catalyst local URL before importing.
              </p>
            </div>
          </div>
        </section>
      )}

      {(existingRecordCount || 0) > 100000 && <section className="rounded-md border border-alert-medium/50 bg-alert-medium/10 p-4 text-sm text-slate-200 shadow-glow"><p className="font-semibold text-alert-medium">Large dataset detected</p><p className="mt-1">Analytics may take longer. CrimePulse AI will use optimized, bounded views for maps, recent records, and chart rankings.</p></section>}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-6 shadow-glow">
        <label
          className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-command-300 bg-command-800" : "border-command-500 bg-command-850/80 hover:bg-command-800"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <FileUp className="h-12 w-12 text-command-300" />
          <span className="mt-4 text-lg font-semibold text-white">
            {file ? file.name : "Upload FIR/crime CSV file"}
          </span>
          <span className="mt-2 max-w-2xl text-sm text-slate-400">
            After choosing a file, CrimePulse AI will validate it and prepare it for import. Different CSV headers are supported.
          </span>
          <button
            className="mt-5 rounded-md bg-command-500 px-4 py-2 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950"
            onClick={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
            type="button"
          >
            Choose File
          </button>
          <input ref={inputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </label>

        {file && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected File</p>
              <p className="text-safe mt-2 text-sm font-semibold text-white" title={file.name}>{file.name}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">File Size</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatFileSize(file.size)}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Preview Status</p>
              <p className="mt-2 text-sm font-semibold text-white">
              {loadingPreview ? `Parsing ${parsingRows.toLocaleString()} rows...` : preview ? "Ready for mapping review" : "Waiting"}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-alert-medium" />
          <div>
            <h2 className="text-base font-semibold text-white">Large Dataset Guidance</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              The Catalyst function inserts in batches. Start with a smaller 1000-row export to validate column quality, table configuration, and function timeout limits before importing the complete dataset.
            </p>
          </div>
        </div>
      </section>

      {preview && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section ref={validationRef} className={`card-safe xl:col-span-2 border p-5 shadow-glow ${validationReady ? "border-alert-low/45 bg-alert-low/5" : "border-alert-critical/45 bg-alert-critical/5"}`}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Step 2: Validate File</p><h2 className="mt-1 text-xl font-semibold text-white">{validationReady ? "File validated. Ready to import records." : "File needs a quick mapping check."}</h2><p className="mt-2 text-sm text-slate-300">{validationReady ? "Continue below to choose how CrimePulse AI should store this file." : "Map the required crime fields below before importing."}</p></div>{validationReady && <button className="inline-flex min-h-10 shrink-0 items-center gap-2 border border-command-300 px-3 text-sm font-semibold text-command-300 hover:bg-command-500/10" onClick={() => importPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">Continue to Import<ArrowDown className="h-4 w-4" /></button>}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">File name</p><p className="text-safe mt-1 text-sm font-semibold text-white" title={file?.name}>{file?.name}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Total rows detected</p><p className="mt-1 text-lg font-semibold text-white">{totalRowsDetected.toLocaleString()}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Valid columns found</p><p className="mt-1 text-lg font-semibold text-alert-low">{mappedColumns} / {canonicalCrimeFields.length}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Missing minimum fields</p><p className="text-safe mt-1 text-sm font-semibold text-white">{preview.detectedMapping?.missingMinimum.length ? preview.detectedMapping.missingMinimum.join(", ") : "None"}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Estimated import</p><p className="mt-1 text-sm font-semibold text-white">{importTargetRows.toLocaleString()} rows · {formatFileSize(file?.size || 0)}</p></div></div>
            {validationReady && <p className="mt-4 flex items-center gap-2 text-sm font-medium text-alert-low"><ArrowDown className="h-4 w-4" />File validated. Continue below to import records.</p>}
          </section>
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-white">CSV Preview</h2>
                <p className="mt-1 text-sm text-slate-400">Detected {preview.headers.length} columns. Showing first 10 rows.</p>
              </div>
              {!preview.detectedMapping?.validDataset ? (
                <span className="rounded border border-alert-critical/40 bg-alert-critical/10 px-3 py-2 text-xs text-alert-critical">
                  Missing: {preview.detectedMapping?.missingMinimum.join(", ")}
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded border border-alert-low/40 bg-alert-low/10 px-3 py-2 text-xs text-alert-low">
                  <CheckCircle2 className="h-4 w-4" />
                  Crime dataset detected
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {preview.headers.map((header) => (
                <span key={header} className="rounded border border-command-700 bg-command-850 px-2 py-1 text-xs text-slate-300">
                  {header}
                </span>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-command-700 text-left text-xs">
                <thead className="bg-command-850 text-slate-400">
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-command-700/70">
                  {preview.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={preview.headers.length || 1}>
                        No preview rows found.
                      </td>
                    </tr>
                  ) : (
                    preview.rows.map((row, index) => (
                      <tr key={`${file?.name}-${index}`}>
                        {preview.headers.map((header) => (
                          <td key={header} className="max-w-56 truncate whitespace-nowrap px-3 py-2 text-slate-300">
                            {row[header] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-command-300" />
              <h2 className="text-base font-semibold text-white">Detected Mapping</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><button className="border border-command-700 px-3 py-2 text-xs text-command-300 hover:bg-command-850" onClick={() => setMapping(preview.detectedMapping?.mapping || {})} type="button">Auto Detect Mapping</button><button className="border border-command-700 px-3 py-2 text-xs text-slate-300 hover:bg-command-850" onClick={() => setMapping({})} type="button">Reset Mapping</button></div>
            <div className="mt-4 max-h-[520px] overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-command-900 text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">CrimePulse Field</th>
                    <th className="py-2 pr-3">CSV Column</th>
                    <th className="py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-command-700/70">
                  {canonicalCrimeFields.map((field) => (
                    <tr key={field}>
                      <td className="py-2 pr-3 font-medium text-command-300">{field}</td>
                      <td className="py-2 pr-3"><select className="w-full min-w-32 bg-command-850 px-2 py-1 text-slate-200 outline-none" value={mapping[field] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}><option value="">Not mapped</option>{preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></td>
                      <td className="py-2 text-slate-300">{mapping[field] ? (preview.detectedMapping?.confidence[field] ? `${preview.detectedMapping.confidence[field]}%` : "Manual") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow xl:col-span-2">
            <h2 className="text-base font-semibold text-white">Import Readiness</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Total rows detected</p><p className="mt-1 text-lg font-semibold text-white">{preview.analysis?.totalRows?.toLocaleString() || parsingRows.toLocaleString()}</p></div><div className="rounded border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Rows with warnings</p><p className="mt-1 text-lg font-semibold text-alert-medium">{preview.analysis?.warningRows?.toLocaleString() || 0}</p></div><div className="rounded border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Date range</p><p className="mt-1 text-sm font-semibold text-white">{preview.analysis?.detectedDateRange || "Detecting"}</p></div><div className="rounded border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Unmapped columns</p><p className="mt-1 text-lg font-semibold text-white">{preview.detectedMapping?.unmappedColumns.length || 0}</p></div></div>
            <p className="text-safe mt-4 text-sm text-slate-400">Districts: {preview.analysis?.detectedDistricts.join(", ") || "None detected"}</p><p className="text-safe mt-1 text-sm text-slate-400">Crime types: {preview.analysis?.detectedCrimeTypes.join(", ") || "None detected"}</p>
          </section>
        </div>
      )}

      {validationReady && <section ref={importPanelRef} className="rounded-md border border-command-300/45 bg-command-900/90 p-5 shadow-glow">
        <div className="mb-6 border-b border-command-700 pb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Step 3: Import Records</p><h2 className="mt-1 text-xl font-semibold text-white">Ready to Import Crime Records</h2><p className="mt-2 text-sm text-slate-400">Choose how CrimePulse AI should store this file. Replace Existing Records is the clearest option for a fresh demo.</p></div>
        {(existingRecordCount ?? 0) > 0 && (
          <div className="mb-5 rounded border border-alert-medium/40 bg-alert-medium/10 p-4 text-sm text-slate-200">
            <p className="font-semibold text-alert-medium">CrimeRecords already contains {(existingRecordCount ?? 0).toLocaleString()} records.</p>
            <p className="mt-1 text-slate-300">Uploading again may create duplicates and consume Catalyst Data Store quota.</p>
          </div>
        )}
          <div className="mb-6 border-b border-command-700 pb-6">
          <label className="block max-w-xl text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Dataset Name<input className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300 disabled:opacity-60" disabled={uploading} value={datasetName} onChange={(event) => setDatasetName(event.target.value)} placeholder="Crime dataset name" /></label>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Import Mode</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {[{ value: "replace", title: "Replace Existing Records", text: "Clears current demo data and imports this file as the active dataset. Recommended for judging and fresh demos.", recommended: true }, { value: "append", title: "Append Records", text: "Keeps existing records and adds this file to the current dataset.", recommended: false }].map((mode) => { const disabled = uploading || (mode.value === "replace" && !canReplaceDataset); return <label key={mode.value} className={`card-safe border p-4 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"} ${importMode === mode.value ? "border-command-300 bg-command-500/10" : "border-command-700 bg-command-850"}`}><input className="sr-only" checked={importMode === mode.value} disabled={disabled} onChange={() => setImportMode(mode.value as "append" | "replace")} type="radio" name="import-mode" /><div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{mode.title}</p>{mode.recommended && <span className="shrink-0 rounded border border-alert-low/40 bg-alert-low/10 px-2 py-1 text-[11px] font-semibold text-alert-low">Recommended</span>}</div><p className="mt-2 text-sm leading-6 text-slate-400">{mode.text}</p></label>})}</div>
          {importMode === "replace" && <div className="mt-4 border border-alert-critical/50 bg-alert-critical/10 p-4 text-sm text-slate-200"><p className="font-semibold text-alert-critical">This will remove existing CrimeRecords data before importing the new CSV.</p><label className="mt-3 flex items-center gap-2"><input checked={confirmReplace} onChange={(event) => setConfirmReplace(event.target.checked)} type="checkbox" />I understand this will remove existing records.</label></div>}
          <p className="mt-4 text-sm text-slate-500">Create New Dataset is unavailable until optional dataset metadata columns are configured.</p>
        </div>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Import settings</p><h2 className="mt-1 text-lg font-semibold text-white">Confirm your import</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose how CrimePulse AI should store this file, then start the import.
            </p>
            </div>
          <div className="flex flex-wrap gap-3"><label className="text-xs uppercase tracking-[0.14em] text-slate-500">Duplicate handling<select className="mt-2 block min-h-11 w-full min-w-44 border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none disabled:opacity-60" disabled={uploading} value={uploadMode} onChange={(event) => setUploadMode(event.target.value as "insert_new" | "skip_duplicates" | "replace")}><option value="skip_duplicates">Skip duplicates</option><option value="insert_new">Insert new only</option><option value="replace">Replace matching records</option></select></label><label className="text-xs uppercase tracking-[0.14em] text-slate-500">Demo import limit<select className="mt-2 block min-h-11 w-full min-w-44 border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none disabled:opacity-60" disabled={uploading} value={importLimit === null ? "full" : importLimit} onChange={(event) => setImportLimit(event.target.value === "full" ? null : Number(event.target.value))}><option value={1000}>1,000 rows</option><option value={10000}>10,000 rows</option><option value={50000}>50,000 rows</option><option value="full">Full CSV</option></select></label></div>
          <p className={`text-safe mt-3 text-xs ${importLimit === null ? "text-alert-medium" : "text-slate-400"}`}>{importLimit === null ? `This file contains ${totalRowsDetected.toLocaleString()} rows. Full import may take long and consume Catalyst credits.` : `Large datasets are supported through batch import. For a fast demo, import ${importLimit.toLocaleString()} rows in approximately ${totalBatchesEstimate.toLocaleString()} batches.`}</p>
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-command-500 px-5 py-3 font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!file || !preview || uploading || !mappingIsUsable || (connectionChecked && !crimeApiConnected)}
            onClick={importCsv}
            type="button"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Importing Records..." : importPhase === "Error" ? "Retry Import" : "Import Records"}
          </button>
          <button className="min-h-11 border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" disabled={uploading} onClick={() => inputRef.current?.click()} type="button">Choose Different File</button>
          {uploading && <button className="min-h-11 border border-alert-critical/50 px-4 py-3 text-sm font-semibold text-alert-critical hover:bg-alert-critical/10" onClick={cancelImport} type="button">Cancel Import</button>}
        </div>

        {(uploading || uploadProgress > 0) && (
          <div ref={progressRef} className="mt-5 rounded border border-command-500/40 bg-command-850 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-command-300">Step 4: Import Progress</p><p className="mt-1 text-sm font-semibold text-white">{importStatusMessage || phaseLabel}</p></div><span className="text-lg font-semibold text-command-300">{uploadProgress}%</span></div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6"><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Phase<strong className="mt-1 block text-white">{phaseLabel}</strong></p><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Parsed rows<strong className="mt-1 block text-white">{parsingRows.toLocaleString()} / {importTargetRows.toLocaleString()}</strong></p><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Clear progress<strong className="mt-1 block text-white">{importPhase === "Clearing" ? `Batch ${clearBatchNumber} · ${clearRemainingRows?.toLocaleString() ?? "checking"} remaining` : clearDeletedRows ? `${clearDeletedRows.toLocaleString()} deleted` : "Not needed"}</strong></p><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Uploading batch<strong className="mt-1 block text-white">{importPhase === "Uploading" || importPhase === "Finishing" || importPhase === "Complete" ? `${uploadState.uploadedBatches} / ${totalBatchesEstimate.toLocaleString()}` : "Waiting"}</strong></p><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Inserted<strong className="mt-1 block text-alert-low">{uploadState.insertedRows.toLocaleString()}</strong></p><p className="border border-command-700 bg-command-900/80 p-3 text-slate-300">Failed / Duplicates<strong className="mt-1 block text-alert-critical">{uploadState.failedRows.toLocaleString()} failed</strong><span className="mt-1 block text-alert-medium">{skippedDuplicates.toLocaleString()} skipped</span></p></div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-command-850">
              <div className="h-full bg-command-300 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </section>}

      {summary?.success && summary.storageVerified && <section ref={successRef} className="card-safe border border-alert-low/50 bg-alert-low/5 p-6 shadow-glow"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-alert-low" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-alert-low">Step 4: Import Complete</p><h2 className="mt-1 text-2xl font-semibold text-white">Crime Data Imported Successfully</h2><p className="mt-2 text-sm text-slate-300">Your records are now ready for analysis.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Records imported</p><p className="mt-1 text-lg font-semibold text-alert-low">{summary.insertedRows.toLocaleString()}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Districts detected</p><p className="mt-1 text-lg font-semibold text-white">{preview?.analysis?.detectedDistricts.length || 0}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Police stations detected</p><p className="mt-1 text-lg font-semibold text-white">{preview?.analysis?.detectedPoliceStations.length || 0}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Crime categories</p><p className="mt-1 text-lg font-semibold text-white">{preview?.analysis?.detectedCrimeTypes.length || 0}</p></div><div className="border border-command-700 bg-command-850 p-3"><p className="text-xs text-slate-500">Coordinate availability</p><p className="mt-1 text-lg font-semibold text-white">{preview?.analysis?.coordinateAvailablePercentage ?? 0}%</p></div></div><div className="mt-5 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center justify-center bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/dashboard">Open Command Dashboard</Link><Link className="inline-flex min-h-11 items-center justify-center border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" to="/records">View Crime Records</Link><Link className="inline-flex min-h-11 items-center justify-center border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" to="/alerts-patterns">Check Alerts & Patterns</Link><Link className="inline-flex min-h-11 items-center justify-center border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" to="/reports-briefing">Generate AI Report</Link></div></section>}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-base font-semibold text-white">Dataset Manager</h2><p className="mt-1 text-sm text-slate-400">Manage uploaded datasets without mixing their records.</p></div><button className="border border-command-700 px-3 py-2 text-sm text-command-300 hover:bg-command-850" onClick={() => void checkConnection()} type="button">Refresh Datasets</button></div>
        {datasetMessage && <p className="mt-3 text-sm text-alert-medium">{datasetMessage}</p>}
        {datasets.length === 0 ? <p className="mt-4 text-sm text-slate-400">No dataset metadata is available yet.</p> : <div className="table-scroll mt-4"><table className="data-table min-w-full text-left text-sm"><thead className="bg-command-850 text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">Dataset</th><th className="px-3 py-3">Records</th><th className="px-3 py-3">Year Range</th><th className="px-3 py-3">Imported</th>{canDeleteDataset && <th className="px-3 py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-command-700/70">{datasets.map((dataset) => <tr key={dataset.dataset_id}><td className="px-3 py-3"><p className="text-safe font-medium text-white">{dataset.dataset_name}</p><p className="text-xs text-slate-500">{dataset.source_file_name}</p></td><td className="px-3 py-3 text-slate-300">{dataset.record_count.toLocaleString()}</td><td className="px-3 py-3 text-slate-300">{dataset.year_range}</td><td className="px-3 py-3 text-slate-300">{dataset.imported_at ? new Date(dataset.imported_at).toLocaleString() : "-"}</td>{canDeleteDataset && <td className="px-3 py-3"><button className="text-alert-critical hover:text-white" onClick={() => void deleteDataset(dataset)} type="button">Delete</button></td>}</tr>)}</tbody></table></div>}
      </section>

      {summary && (
        <section className="rounded-md border border-alert-low/40 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Upload Summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total Rows</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.totalRows}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Valid Rows</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.validRows}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Inserted Rows</p>
              <p className="mt-2 text-2xl font-semibold text-alert-low">{summary.insertedRows}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Skipped Rows</p>
              <p className="mt-2 text-2xl font-semibold text-alert-medium">{summary.skippedRows}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Error Rows</p>
              <p className="mt-2 text-2xl font-semibold text-alert-critical">{summary.errorRows}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Skipped Duplicates</p>
              <p className="mt-2 text-2xl font-semibold text-alert-medium">{summary.skippedDuplicates || 0}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Warning Rows</p>
              <p className="mt-2 text-2xl font-semibold text-alert-medium">{summary.warningRows || 0}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Storage Verified</p>
              <p className={`mt-2 text-2xl font-semibold ${summary.storageVerified ? "text-alert-low" : "text-alert-critical"}`}>
                {summary.storageVerified ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Stored Count</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.storedRecordCountAfterUpload}</p>
            </div>
          </div>
          {(summary.validationErrors.length > 0 || (summary.batchErrors?.length || 0) > 0) && (
            <div className="mt-5 rounded border border-alert-high/40 bg-alert-high/10 p-4">
              <h3 className="font-semibold text-alert-high">Validation and Storage Errors</h3>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-slate-300">
                {[...summary.validationErrors, ...(summary.batchErrors || [])].map((validationError) => (
                  <li key={validationError}>{validationError}</li>
                ))}
              </ul>
            </div>
          )}
          {(summary.failedRowDetails?.length || 0) > 0 && <button className="mt-4 border border-command-700 px-3 py-2 text-sm text-command-300 hover:bg-command-850" onClick={() => downloadFailedRows(summary)} type="button">Download Error Report CSV</button>}
        </section>
      )}

      {summary?.storageVerified && <RecommendedNextStep title="Open Command Dashboard" description="Your upload is stored and verified. Review command-level trends, districts, crime types, and data quality next." to="/dashboard" action="Open Dashboard" />}

      {error && (
        <div className="space-y-3">
          <StateBlock title="Upload error" message={error} />
          {file && !uploading && <button className="inline-flex min-h-11 items-center justify-center border border-command-700 px-5 py-3 text-sm font-semibold text-command-300 hover:bg-command-850" onClick={() => void importCsv()} type="button">Retry Import</button>}
          {quotaLimitReached && (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-command-500 px-5 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950"
              to="/dashboard"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      )}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Required CSV Columns</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {crimeCsvColumns.map((column) => (
            <span key={column} className="rounded border border-command-700 bg-command-850 px-2 py-1 text-xs text-slate-300">
              {column}
            </span>
          ))}
        </div>
      </section>

      {resetOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-command-950/85 p-4"><section aria-modal="true" className="w-full max-w-lg border border-alert-critical/50 bg-command-900 p-6 shadow-2xl" role="dialog"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-alert-critical">Super Admin Action</p><h2 className="mt-2 text-2xl font-semibold text-white">Reset Demo Data?</h2><p className="mt-3 text-sm leading-6 text-slate-300">This will remove all uploaded CrimeRecords and return the app to a fresh demo state.</p>{resetting && <div className="mt-5 border border-command-500/40 bg-command-850 p-4 text-sm"><p className="font-semibold text-white">Resetting records...</p><p className="mt-2 text-slate-300">{resetStatusMessage}</p><div className="mt-3 h-2 overflow-hidden rounded bg-command-700"><div className="h-full bg-alert-critical transition-all" style={{ width: `${resetRemainingRows === null || (existingRecordCount ?? 0) === 0 ? 0 : Math.min(100, Math.round((resetDeletedRows / (existingRecordCount ?? 1)) * 100))}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400"><span>Batch: {resetBatchNumber}</span><span>Deleted: {resetDeletedRows.toLocaleString()}</span><span>Remaining: {resetRemainingRows?.toLocaleString() ?? "Checking"}</span><span>Progress: {resetRemainingRows === null || (existingRecordCount ?? 0) === 0 ? 0 : Math.min(100, Math.round((resetDeletedRows / (existingRecordCount ?? 1)) * 100))}%</span></div></div>}{resetError && <p className="mt-4 border border-alert-critical/50 bg-alert-critical/10 p-3 text-sm text-alert-critical">{resetError}</p>}<label className="mt-5 flex items-center gap-2 text-sm text-slate-200"><input checked={resetConfirmed} disabled={resetting} onChange={(event) => setResetConfirmed(event.target.checked)} type="checkbox" />I understand this will remove existing records.</label><label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Type RESET to confirm<input className="mt-2 min-h-11 w-full border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-alert-critical disabled:opacity-60" disabled={resetting} onChange={(event) => setResetText(event.target.value)} value={resetText} /></label><div className="mt-6 flex justify-end gap-3">{resetting ? <button className="min-h-11 border border-alert-medium/50 px-4 text-sm font-semibold text-alert-medium hover:bg-alert-medium/10" onClick={cancelReset} type="button">Cancel Reset</button> : <button className="min-h-11 border border-command-700 px-4 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setResetOpen(false); setResetConfirmed(false); setResetText(""); }} type="button">Cancel</button>}<button className="min-h-11 bg-alert-critical px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!resetConfirmed || resetText !== "RESET" || resetting} onClick={() => void resetDemoData()} type="button">{resetting ? "Resetting..." : resetError ? "Retry Reset" : "Reset Demo Data"}</button></div></section></div>}
    </div>
  );
};

export default UploadCrimeData;
