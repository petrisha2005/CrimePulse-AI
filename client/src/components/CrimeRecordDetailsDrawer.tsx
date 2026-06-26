import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { CrimeRecord } from "../types/crime";

const value = (input: unknown) => {
  const text = String(input ?? "").trim();
  return text || "-";
};

const hasCoordinates = (record: CrimeRecord) =>
  record.latitude_value !== null &&
  record.latitude_value !== undefined &&
  record.longitude_value !== null &&
  record.longitude_value !== undefined &&
  String(record.latitude_value).trim() !== "" &&
  String(record.longitude_value).trim() !== "";

const DetailItem = ({ label, value: itemValue }: { label: string; value: unknown }) => (
  <div className="min-w-0 rounded border border-command-700 bg-command-850 p-3">
    <p className="truncate text-xs uppercase tracking-[0.14em] text-slate-500" title={label}>{label}</p>
    <p className="mt-1 text-safe text-sm font-medium text-white" title={value(itemValue)}>{value(itemValue)}</p>
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-md border border-command-700 bg-command-900/90 p-4 shadow-glow">
    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-command-300">{title}</h3>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
  </section>
);

const CrimeRecordDetailsDrawer = ({ record, onClose }: { record: CrimeRecord | null; onClose: () => void }) => {
  useEffect(() => {
    if (!record) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, record]);

  if (!record) return null;

  const coordinatesAvailable = hasCoordinates(record);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true" aria-label="Crime Record Details" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-command-700 bg-command-950 p-5 shadow-glow" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-command-700 bg-command-950/95 px-5 py-5 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-command-300">Crime Record Details</p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-white" title={record.crime_id}>{record.crime_id}</h2>
          </div>
          <button className="rounded border border-command-700 p-2 text-slate-300 hover:bg-command-850" onClick={onClose} type="button" aria-label="Close crime record details">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <DetailSection title="Basic Details">
            <DetailItem label="Crime ID" value={record.crime_id} />
            <DetailItem label="District" value={record.district} />
            <DetailItem label="Police Station" value={record.police_station} />
            <DetailItem label="Crime Type" value={record.crime_type} />
            <DetailItem label="Crime Subtype" value={record.crime_subtype} />
            <DetailItem label="Severity" value={record.severity} />
          </DetailSection>

          <DetailSection title="FIR Information">
            <DetailItem label="FIR Year" value={record.fir_year} />
            <DetailItem label="FIR Month" value={record.fir_month} />
            <DetailItem label="FIR Day" value={record.fir_day} />
            <DetailItem label="FIR Stage" value={record.fir_stage} />
            <DetailItem label="Complaint Mode" value={record.complaint_mode} />
            <DetailItem label="Act Section" value={record.act_section} />
          </DetailSection>

          <DetailSection title="Location Details">
            <DetailItem label="Place of Offence" value={record.offence_location} />
            <DetailItem label="Beat Name" value={record.beat_name} />
            <DetailItem label="Village / Area Name" value={record.village_area_name} />
            <DetailItem label="Latitude" value={record.latitude_value} />
            <DetailItem label="Longitude" value={record.longitude_value} />
            <DetailItem label="Coordinate Availability" value={coordinatesAvailable ? "Available" : "Missing"} />
          </DetailSection>

          <DetailSection title="People & Case Counts">
            <DetailItem label="Victim Count" value={record.victim_count} />
            <DetailItem label="Accused Count" value={record.accused_count} />
            <DetailItem label="Arrested Count" value={record.arrested_count} />
            <DetailItem label="Conviction Count" value={record.conviction_count} />
          </DetailSection>

          <DetailSection title="System Details">
            <DetailItem label="Unit ID" value={record.unit_id} />
            <DetailItem label="Created Time" value={record.created_time} />
          </DetailSection>
        </div>
      </aside>
    </div>
  );
};

export default CrimeRecordDetailsDrawer;
