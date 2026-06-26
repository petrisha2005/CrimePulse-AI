import { Database, Download, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { CrimePulseUser } from "../auth/users";
import { useAuth } from "../auth/AuthContext";
import { sampleCrimeCsv } from "../utils/crimeCsvConfig";
import { GuidedJourney } from "./ModuleGuide";

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

const NoDataState = ({ currentUser, moduleName, dashboard = false }: { currentUser: CrimePulseUser | null; moduleName: string; dashboard?: boolean }) => {
  const content = contentFor(currentUser, moduleName);
  const { canAccessRoute } = useAuth();
  const [showJourney, setShowJourney] = useState(false);
  return (
    <section className="card-safe border border-command-700 bg-command-900/85 p-7 text-center shadow-glow sm:p-10">
      <Database className="mx-auto h-8 w-8 text-command-300" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-command-300">Fresh Demo Mode</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{content.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">{dashboard ? "Upload a FIR/crime CSV file to generate dashboards, alerts, hotspot maps, forecasts, AI insights, and reports." : content.message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{content.canUpload && <Link className="inline-flex min-h-11 items-center justify-center gap-2 bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" to="/upload"><UploadCloud className="h-4 w-4" />Upload Crime Data</Link>}{dashboard && content.canUpload && <button className="inline-flex min-h-11 items-center justify-center gap-2 border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" onClick={downloadSampleCsv} type="button"><Download className="h-4 w-4" />Download Sample CSV</button>}{dashboard && <button className="inline-flex min-h-11 items-center justify-center gap-2 border border-command-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-850" onClick={() => setShowJourney((visible) => !visible)} type="button">{showJourney ? "Hide Demo Journey" : "View Demo Journey"}</button>}</div>
      {dashboard && showJourney && <div className="mt-8 text-left"><GuidedJourney canAccessRoute={canAccessRoute} /></div>}
    </section>
  );
};

export default NoDataState;
