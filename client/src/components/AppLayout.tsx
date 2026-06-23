import { Activity, BarChart3, BellRing, BrainCircuit, Clock3, CloudSun, FileText, Fingerprint, FolderSearch, GraduationCap, Home, LogOut, Map, Presentation, Radar, Shield, Sparkles, UploadCloud, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import DatasetStatusWidget from "./DatasetStatusWidget";
import { useAuth } from "../auth/AuthContext";
import RoleBadge from "./auth/RoleBadge";
import { getScopeLabel } from "../auth/accessScope";
import { crimeService } from "../services/crimeService";
import { dashboardService } from "../services/dashboardService";
import type { GlobalStats } from "../types/crime";
import type { CrimeDataset } from "../types/crime";
import { getActiveDatasetId, setActiveDatasetId } from "../services/datasetScope";

const navGroups = [
  {
    label: "Core",
    items: [
      { label: "Home", to: "/home", icon: Home },
      { label: "Dashboard", to: "/dashboard", icon: Activity },
      { label: "Upload Crime Data", to: "/upload", icon: UploadCloud },
      { label: "Crime Records", to: "/records", icon: FolderSearch }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { label: "District Risk DNA", to: "/district-risk-dna", icon: Fingerprint },
      { label: "Red-Zone Alerts", to: "/alerts", icon: BellRing },
      { label: "Pattern Discovery", to: "/pattern-discovery", icon: BrainCircuit },
      { label: "Hotspot Map", to: "/hotspot-map", icon: Map },
      { label: "Crime Time Machine", to: "/crime-time-machine", icon: Clock3 }
    ]
  },
  {
    label: "Prediction",
    items: [
      { label: "Crime Forecast", to: "/crime-forecast", icon: CloudSun },
      { label: "Socio-Economic Insights", to: "/socio-economic-insights", icon: GraduationCap },
      { label: "District Analytics", to: "/district-analytics", icon: BarChart3 },
      { label: "Risk Intelligence", to: "/risk-intelligence", icon: Radar }
    ]
  },
  {
    label: "AI",
    items: [
      { label: "AI Insights", to: "/ai-insights", icon: Sparkles },
      { label: "AI Report Generator", to: "/ai-report", icon: FileText },
      { label: "Reports", to: "/reports", icon: FileText }
    ]
  },
  {
    label: "Demo",
    items: [
      { label: "Presentation Mode", to: "/presentation-mode", icon: Presentation }
    ]
  }
];
const navItems = navGroups.flatMap((group) => group.items);

const getTotalRecords = (response: { totalRecords?: number; data?: { totalRecords?: number } }) =>
  response.totalRecords ?? response.data?.totalRecords ?? 0;

const AppLayout = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [datasets, setDatasets] = useState<CrimeDataset[]>([]);
  const [activeDatasetId, setActiveDatasetIdState] = useState(getActiveDatasetId());
  const location = useLocation();
  const { currentUser: user, canAccessRoute, logout, preferences } = useAuth();
  const pageTitle = navItems.find((item) => item.to === location.pathname)?.label || "CrimePulse AI";

  const loadGlobalStats = async () => {
    try {
      const countResponse = await crimeService.getCrimeCount();
      console.log("Crime count response:", countResponse);
      const totalRecords = getTotalRecords(countResponse);
      setStats((current) => ({
        total_records: totalRecords,
        total_districts: current?.total_districts ?? 0,
        total_police_stations: current?.total_police_stations ?? 0,
        year_range: current?.year_range ?? "No data",
        total_crime_groups: current?.total_crime_groups ?? 0,
        records_with_coordinates: current?.records_with_coordinates ?? 0,
        records_without_coordinates: current?.records_without_coordinates ?? totalRecords,
        coordinate_available_percentage: current?.coordinate_available_percentage ?? 0,
        data_quality_score: current?.data_quality_score ?? 0,
        last_updated: current?.last_updated ?? "",
        partial: current?.partial ?? true,
        message: current?.message ?? "Analytics loading/unavailable"
      }));

      const statsResponse = await dashboardService.getGlobalStats();
      console.log("Global stats response:", statsResponse);
      const mergedStats = {
        ...statsResponse.data,
        total_records: totalRecords
      };
      console.log("Topbar global stats:", mergedStats);
      setStats(mergedStats);
    } catch (error) {
      console.error("[CrimePulse AI] unable to load topbar global stats", error);
      try {
        const countResponse = await crimeService.getCrimeCount();
        console.log("Crime count response:", countResponse);
        const totalRecords = getTotalRecords(countResponse);
        setStats({
          total_records: totalRecords,
          total_districts: 0,
          total_police_stations: 0,
          year_range: "No data",
          total_crime_groups: 0,
          records_with_coordinates: 0,
          records_without_coordinates: totalRecords,
          coordinate_available_percentage: 0,
          data_quality_score: 0,
          last_updated: "",
          partial: true,
          message: "Analytics loading/unavailable"
        });
      } catch {
        setStats(null);
      }
    }
  };

  useEffect(() => {
    loadGlobalStats();
    crimeService.getDatasets().then((response) => setDatasets(response.data || [])).catch(() => setDatasets([]));
    window.addEventListener("crimepulse:dataset-updated", loadGlobalStats);
    return () => window.removeEventListener("crimepulse:dataset-updated", loadGlobalStats);
  }, []);

  return (
  <div className={`min-h-screen min-w-0 bg-command-950 text-slate-100 ${preferences?.themeDensity === "compact" ? "density-compact" : "density-comfortable"}`}>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-command-700/70 bg-command-900/95 px-5 py-6 shadow-glow lg:flex">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded border border-command-500/60 bg-command-800">
          <Shield className="h-6 w-6 text-command-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Karnataka Police</p>
          <h1 className="text-lg font-semibold">CrimePulse AI</h1>
        </div>
      </div>

      <nav className="mt-8 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canAccessRoute(item.to));
          if (!visibleItems.length) return null;
          return <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
            <div className="space-y-1.5">
              {visibleItems.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-command-700 text-white"
                        : "text-slate-300 hover:bg-command-850 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>;
        })}
      </nav>

      <div className="mt-5 space-y-3">
        <div className="rounded-md border border-command-700 bg-command-850 px-3 py-3">
          <p className="truncate text-sm font-medium text-white">{user?.name || "Authorized Officer"}</p>
          <p className="truncate text-xs text-slate-400">{user?.roleLabel || "Authorized role"} · {getScopeLabel(user)}</p>
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md border border-command-700 px-3 py-3 text-sm text-slate-300 hover:bg-command-850"
          onClick={() => void logout()}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>

    <header className="sticky top-0 z-10 border-b border-command-700/60 bg-command-900/95 px-4 py-4 backdrop-blur lg:ml-72">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Shield className="h-6 w-6 text-command-300" />
          <span className="font-semibold lg:hidden">CrimePulse AI</span>
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs uppercase tracking-[0.16em] text-command-300">Secure Command Session</p>
            <h2 className="truncate text-lg font-semibold text-white" title={pageTitle}>{pageTitle}</h2>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {datasets.length > 0 && <label className="hidden max-w-48 xl:block"><span className="sr-only">Dataset scope</span><select className="w-full border border-command-700 bg-command-850 px-2 py-2 text-xs text-slate-200 outline-none" value={activeDatasetId} onChange={(event) => { const next = event.target.value; setActiveDatasetId(next); setActiveDatasetIdState(next); window.location.reload(); }}><option value="">All Datasets</option>{datasets.map((dataset) => <option key={dataset.dataset_id} value={dataset.dataset_id}>{dataset.dataset_name}</option>)}</select></label>}
          <DatasetStatusWidget stats={stats} compact />
          <div className="hidden min-w-0 max-w-48 text-right sm:block">
            <p className="truncate text-sm font-medium text-white" title={user?.name || "Authorized Officer"}>{user?.name || "Authorized Officer"}</p>
            <div className="mt-1 flex justify-end"><RoleBadge role={user?.role || "crime_analyst"} label={user?.roleLabel || "Crime Analyst"} /></div>
            <p className="mt-1 truncate text-xs text-slate-400" title={getScopeLabel(user)}>{getScopeLabel(user)}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded border border-command-700 bg-command-850">
            <UserCircle className="h-5 w-5 text-command-300" />
          </div>
          <button
            className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-command-700 px-3 text-sm text-slate-300 hover:bg-command-850"
            onClick={() => void logout()}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      <nav className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
        {navItems.filter((item) => canAccessRoute(item.to)).map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
                isActive ? "bg-command-700" : "bg-command-850 text-slate-300"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate-2 min-w-0 text-center leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>

    <main className="lg:ml-72">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </main>
  </div>
  );
};

export default AppLayout;
