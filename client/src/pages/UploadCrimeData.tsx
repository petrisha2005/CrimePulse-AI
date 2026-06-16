import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import type { CsvPreview, UploadSummary } from "../types/crime";
import { crimeCsvColumns, crimeCsvMapping, sampleCrimeCsv } from "../utils/crimeCsvConfig";
import { buildCsvPreview } from "../utils/csvPreview";

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

const getTotalRecords = (response: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  response.totalRecords ?? response.data?.totalRecords ?? 0;

const UploadCrimeData = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
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
      } catch {
        setExistingRecordCount(null);
      }
    }
    return connected;
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const resetResultState = () => {
    setError("");
    setSummary(null);
    setUploadProgress(0);
    setQuotaLimitReached(false);
  };

  const prepareFile = async (selectedFile: File | null) => {
    resetResultState();
    setPreview(null);
    setFile(selectedFile);

    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Select a valid CSV file.");
      return;
    }

    try {
      setLoadingPreview(true);
      setPreview(await buildCsvPreview(selectedFile));
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
      setError("Select a CSV file before importing.");
      return;
    }

    if (preview?.missingRequired.length) {
      setError(`Missing required columns: ${preview.missingRequired.join(", ")}`);
      return;
    }

    try {
      const connected = await checkConnection();
      if (!connected) {
        setError(catalystConnectionMessage);
        return;
      }

      setUploading(true);
      setError("");
      setSummary(null);
      const response = await crimeService.uploadCrimeCSV(file, setUploadProgress);
      setSummary(response.data);
      window.dispatchEvent(new Event("crimepulse:dataset-updated"));
      if (!response.data.success || !response.data.storageVerified || response.data.insertedRows === 0) {
        setError(
          `Upload parsed successfully, but Data Store insert failed: ${
            response.data.batchErrors?.join(" | ") || "storage verification did not confirm inserted records"
          }`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV upload failed";
      if (message.includes("FREE_USAGE_LIMIT_REACHED")) {
        setQuotaLimitReached(true);
        setError(
          "Catalyst free Data Store insert limit has been reached. Existing records are still available for analytics. Go to Dashboard instead of uploading again."
        );
      } else {
        setError(message);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Data Intake</p>
          <h1 className="text-3xl font-semibold text-white">Upload Crime Data</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Import Karnataka crime CSV records into Catalyst Data Store. For the first run, test with a 1000-row sample before uploading the full 16+ lakh row dataset.
          </p>
        </div>
        <button
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800"
          onClick={downloadSampleCsv}
          type="button"
        >
          <Download className="h-4 w-4" />
          Download Sample CSV
        </button>
      </div>

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
            {file ? file.name : "Drop Karnataka crime CSV here"}
          </span>
          <span className="mt-2 max-w-2xl text-sm text-slate-400">
            Drag and drop a CSV file or choose one from your system. Rows without latitude or longitude are accepted for district-level analytics.
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
              <p className="mt-2 truncate text-sm font-semibold text-white">{file.name}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">File Size</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatFileSize(file.size)}</p>
            </div>
            <div className="rounded border border-command-700 bg-command-850 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Preview Status</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {loadingPreview ? "Reading first rows..." : preview ? "Ready for review" : "Waiting"}
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
          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-white">CSV Preview</h2>
                <p className="mt-1 text-sm text-slate-400">Detected {preview.headers.length} columns. Showing first 10 rows.</p>
              </div>
              {preview.missingRequired.length > 0 ? (
                <span className="rounded border border-alert-critical/40 bg-alert-critical/10 px-3 py-2 text-xs text-alert-critical">
                  Missing: {preview.missingRequired.join(", ")}
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded border border-alert-low/40 bg-alert-low/10 px-3 py-2 text-xs text-alert-low">
                  <CheckCircle2 className="h-4 w-4" />
                  Required columns detected
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
              <h2 className="text-base font-semibold text-white">CrimeRecords Mapping</h2>
            </div>
            <div className="mt-4 max-h-[520px] overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-command-900 text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Data Store Field</th>
                    <th className="py-2">CSV Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-command-700/70">
                  {crimeCsvMapping.map(([field, column]) => (
                    <tr key={field}>
                      <td className="py-2 pr-3 font-medium text-command-300">{field}</td>
                      <td className="py-2 text-slate-300">{column}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        {(existingRecordCount ?? 0) > 0 && (
          <div className="mb-5 rounded border border-alert-medium/40 bg-alert-medium/10 p-4 text-sm text-slate-200">
            <p className="font-semibold text-alert-medium">CrimeRecords already contains {(existingRecordCount ?? 0).toLocaleString()} records.</p>
            <p className="mt-1 text-slate-300">Uploading again may create duplicates and consume Catalyst Data Store quota.</p>
          </div>
        )}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-white">Confirm Import</h2>
            <p className="mt-1 text-sm text-slate-400">
              Data will be sent to the Catalyst `crime-api` function and inserted into the `CrimeRecords` Data Store table.
            </p>
          </div>
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-command-500 px-5 py-3 font-semibold text-white hover:bg-command-300 hover:text-command-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!file || !preview || uploading || !!preview.missingRequired.length || (connectionChecked && !crimeApiConnected)}
            onClick={importCsv}
            type="button"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Importing..." : "Confirm Import"}
          </button>
        </div>

        {(uploading || uploadProgress > 0) && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-command-850">
              <div className="h-full bg-command-300 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
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
        </section>
      )}

      {error && (
        <div className="space-y-3">
          <StateBlock title="Upload error" message={error} />
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
    </div>
  );
};

export default UploadCrimeData;
