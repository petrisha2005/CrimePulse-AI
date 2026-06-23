import { Database, Download, FileCheck2, Radar, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import type { CrimePulseUser } from "../auth/users";
import { sampleCrimeCsv } from "../utils/crimeCsvConfig";

const contentFor = (user: CrimePulseUser | null, moduleName: string) => {
  if (user?.role === "super_admin") {
    return {
      title: "No crime records uploaded yet.",
      message: `Upload a CSV file to begin ${moduleName.toLowerCase()} and crime intelligence analysis.`,
      canUpload: true
    };
  }
  if (user?.role === "district_officer") {
    return { title: "No district crime data available yet.", message: "Data will appear here after the Super Admin uploads records.", canUpload: false };
  }
  if (user?.role === "station_officer") {
    return { title: "No station crime data available yet.", message: "Data will appear here after the Super Admin uploads records.", canUpload: false };
  }
  return { title: "No crime data available yet.", message: "Please wait for the Super Admin to upload crime records.", canUpload: false };
};

const downloadSampleCsv = () => {
  const url = URL.createObjectURL(new Blob([sampleCrimeCsv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "crimepulse-sample-crime-data.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const workflow = [["1", "Upload CSV", UploadCloud], ["2", "Validate & Store Records", FileCheck2], ["3", "Generate Intelligence", Radar], ["4", "Explore Reports", Database]] as const;

const NoDataState = ({ currentUser, moduleName, dashboard = false }: { currentUser: CrimePulseUser | null; moduleName: string; dashboard?: boolean }) => {
  const content = contentFor(currentUser, moduleName);
  return (
    <section className="card-safe border border-command-700 bg-command-900/85 p-7 text-center shadow-glow sm:p-10">
      <Database className="mx-auto h-8 w-8 text-command-300" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Fresh Demo Mode</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{content.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">{dashboard ? "Upload a FIR/crime CSV file to generate dashboards, alerts, hotspot maps, forecasts, AI insights, and reports." : content.message}</p>
      {content.canUpload && <div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="inline-flex min-h-11 items-center justify-center gap-2 bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/upload"><UploadCloud className="h-4 w-4" />Upload Crime Data</Link>{dashboard && <button className="inline-flex min-h-11 items-center justify-center gap-2 border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" onClick={downloadSampleCsv} type="button"><Download className="h-4 w-4" />Download Sample CSV</button>}</div>}
      {dashboard && <div className="mx-auto mt-9 grid max-w-4xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">{workflow.map(([step, label, Icon]) => <div key={step} className="border border-command-700 bg-command-850 p-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-command-500/15 text-xs font-semibold text-command-300">{step}</span><Icon className="mt-4 h-5 w-5 text-command-300" /><p className="mt-3 text-sm font-semibold text-white">{label}</p></div>)}</div>}
    </section>
  );
};

export default NoDataState;
