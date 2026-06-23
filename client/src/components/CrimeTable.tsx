import type { CrimeRecord } from "../types/crime";
import StateBlock from "./StateBlock";

const severityClass = {
  Low: "bg-alert-low/15 text-alert-low",
  Medium: "bg-alert-medium/15 text-alert-medium",
  High: "bg-alert-high/15 text-alert-high",
  Critical: "bg-alert-critical/15 text-alert-critical"
};

const CrimeTable = ({ records }: { records: CrimeRecord[] }) => {
  if (records.length === 0) {
    return <StateBlock title="No crime records" message="Upload CSV data or create records to populate this table." />;
  }

  return (
    <section className="overflow-hidden rounded-md border border-command-700 bg-command-900/85 shadow-glow">
      <div className="border-b border-command-700 px-5 py-4">
        <h2 className="text-base font-semibold text-white">Recent Crime Records</h2>
      </div>
      <div className="table-scroll">
        <table className="data-table min-w-full divide-y divide-command-700 text-left text-sm">
          <thead className="bg-command-850 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Crime ID</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Subtype</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">FIR Year</th>
              <th className="px-4 py-3">FIR Month</th>
              <th className="px-4 py-3">FIR Day</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Complaint Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-command-700/70">
            {records.map((record) => (
              <tr key={record.ROWID || record.crime_id} className="hover:bg-command-850/70">
                <td className="px-4 py-3 font-medium text-command-300" title={record.crime_id}>{record.crime_id}</td>
                <td className="px-4 py-3 text-slate-200" title={record.district}>{record.district}</td>
                <td className="px-4 py-3 text-slate-300" title={record.police_station}>{record.police_station}</td>
                <td className="px-4 py-3 text-slate-300" title={record.crime_type}>{record.crime_type}</td>
                <td className="px-4 py-3 text-slate-300" title={record.crime_subtype}>{record.crime_subtype}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${severityClass[record.severity]}`}>
                    {record.severity}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.fir_year}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.fir_month}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.fir_day}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.crime_date}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.fir_stage}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{record.complaint_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CrimeTable;
