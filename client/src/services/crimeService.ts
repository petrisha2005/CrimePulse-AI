import type { ApiResponse, CrimeCount, CrimeRecord, CrimeRecordFilterOptions, CrimeRecordQuery, UploadSummary } from "../types/crime";

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
          const body = JSON.parse(xhr.responseText || "{}") as ApiResponse<UploadSummary> & { message?: string };
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve(body);
            return;
          }
          const batchDetails = body.data?.batchErrors?.length ? body.data.batchErrors.join(" | ") : "";
          const backendDetails = [
            body.message,
            (body as { error?: string }).error,
            (body as { details?: string }).details,
            batchDetails,
            (body as { samplePayloadKeys?: string[] }).samplePayloadKeys?.length
              ? `Insert payload keys: ${(body as { samplePayloadKeys: string[] }).samplePayloadKeys.join(", ")}`
              : "",
            (body as { suggestion?: string }).suggestion
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

  getCrimeRecords() {
    return request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes`);
  },

  getCrimeRecordsPage(query?: CrimeRecordQuery) {
    return request<ApiResponse<CrimeRecord[]>>(`${crimeApiBase}/crimes${queryString(query)}`);
  },

  getCrimeCount() {
    return request<ApiResponse<CrimeCount>>(`${crimeApiBase}/crimes/count`);
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
