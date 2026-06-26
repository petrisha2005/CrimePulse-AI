import { useMemo, useState } from "react";
import { Eye, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { CrimeRecord } from "../types/crime";
import StateBlock from "./StateBlock";
import CrimeRecordDetailsDrawer from "./CrimeRecordDetailsDrawer";

const severityClass = {
  Low: "border-alert-low/40 bg-alert-low/15 text-alert-low",
  Medium: "border-alert-medium/40 bg-alert-medium/15 text-alert-medium",
  High: "border-alert-high/40 bg-alert-high/15 text-alert-high",
  Critical: "border-alert-critical/40 bg-alert-critical/15 text-alert-critical"
};

const CompactCell = ({ value, className = "" }: { value?: string | number | null; className?: string }) => (
  <span className={`block max-w-full truncate whitespace-nowrap ${className}`} title={String(value ?? "-")}>{String(value ?? "-") || "-"}</span>
);

const CrimeTable = ({ records, limit = 10 }: { records: CrimeRecord[]; limit?: number }) => {
  const [selected, setSelected] = useState<CrimeRecord | null>(null);
  const previewRecords = records.slice(0, limit);
  const showDistrict = useMemo(() => new Set(records.map((record) => record.district).filter(Boolean)).size > 1, [records]);

  if (records.length === 0) {
    return <StateBlock title="No recent crime records available." message="Recent records will appear here after matching records are found." />;
  }

  return (
    <>
      <section className="overflow-hidden rounded-md border border-command-700 bg-command-900/85 shadow-glow">
        <div className="flex flex-col justify-between gap-3 border-b border-command-700 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">Recent Crime Records</h2>
            <p className="mt-1 text-sm text-slate-400">Latest {previewRecords.length} records from the current dashboard scope.</p>
          </div>
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-3 text-sm font-semibold text-command-300 hover:bg-command-800 hover:text-white" to="/records">
            View All Records
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
        <div className="table-scroll">
          <table className="data-table min-w-full table-fixed divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-40 px-4 py-3">Crime ID</th>
                {showDistrict && <th className="w-36 px-4 py-3">District</th>}
                <th className="w-56 px-4 py-3">Crime Type</th>
                <th className="w-52 px-4 py-3">Police Station</th>
                <th className="w-28 px-4 py-3">Severity</th>
                <th className="w-24 px-4 py-3">FIR Year</th>
                <th className="w-28 px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {previewRecords.map((record) => (
                <tr key={record.ROWID || record.crime_id} className="hover:bg-command-850/70">
                  <td className="px-4 py-3 font-medium text-command-300">
                    <button className="block max-w-full truncate whitespace-nowrap hover:text-white" title={record.crime_id} onClick={() => setSelected(record)} type="button">
                      {record.crime_id}
                    </button>
                  </td>
                  {showDistrict && <td className="px-4 py-3 text-slate-200"><CompactCell value={record.district} /></td>}
                  <td className="px-4 py-3 text-slate-300"><CompactCell value={record.crime_type} /></td>
                  <td className="px-4 py-3 text-slate-300"><CompactCell value={record.police_station} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded border px-2 py-1 text-xs font-semibold ${severityClass[record.severity] || severityClass.Low}`}>
                      {record.severity || "Low"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.fir_year || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="inline-flex items-center gap-2 rounded border border-command-700 px-3 py-2 text-xs font-semibold text-command-300 hover:bg-command-800 hover:text-white" onClick={() => setSelected(record)} type="button">
                      <Eye className="h-4 w-4" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <CrimeRecordDetailsDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  );
};

export default CrimeTable;
