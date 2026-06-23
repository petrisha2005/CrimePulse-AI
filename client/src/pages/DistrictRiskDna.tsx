import { useEffect, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Crosshair, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import {
  DistributionPieChart,
  MonthlyTrendChart,
  RankingBarChart
} from "../components/ChartPanel";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { riskService } from "../services/riskService";
import type { DashboardFilterOptions, DashboardFilters, DistrictRiskDna, DistrictRiskListItem } from "../types/crime";

const emptyFilterOptions: DashboardFilterOptions = {
  years: [],
  months: [],
  districts: [],
  policeStations: [],
  crimeTypes: [],
  severities: [],
  statuses: []
};

const riskColor = {
  Low: "text-alert-low border-alert-low/40 bg-alert-low/10",
  Medium: "text-alert-medium border-alert-medium/40 bg-alert-medium/10",
  High: "text-alert-high border-alert-high/40 bg-alert-high/10",
  Critical: "text-alert-critical border-alert-critical/40 bg-alert-critical/10"
};

const RiskGauge = ({ score, level }: { score: number; level: DistrictRiskDna["risk_level"] }) => (
  <div className="flex flex-col items-center justify-center rounded-md border border-command-700 bg-command-900/85 p-6 shadow-glow">
    <div
      className="flex h-48 w-48 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#ef4444 ${score * 3.6}deg, #14283d 0deg)` }}
    >
      <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-command-700 bg-command-950">
        <span className="text-5xl font-semibold text-white">{score}</span>
        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Risk Score</span>
      </div>
    </div>
    <span className={`mt-5 rounded border px-3 py-2 text-sm font-semibold ${riskColor[level]}`}>{level} Risk</span>
  </div>
);

const SelectFilter = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select
      className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">All</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

const BulletPanel = ({ title, items }: { title: string; items: string[] }) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    {items.length === 0 ? (
      <p className="mt-3 text-sm text-slate-400">No signals available.</p>
    ) : (
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-command-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const DistrictRiskDna = () => {
  const [districts, setDistricts] = useState<DistrictRiskListItem[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions>(emptyFilterOptions);
  const [filters, setFilters] = useState<Pick<DashboardFilters, "fir_year" | "fir_month" | "crime_type" | "severity" | "fir_stage">>({
    fir_year: "",
    fir_month: "",
    crime_type: "",
    severity: "",
    fir_stage: ""
  });
  const [dna, setDna] = useState<DistrictRiskDna | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadDistricts = async () => {
    const [districtRes, filterRes] = await Promise.all([
      riskService.getDistricts(filters),
      riskService.getFilters()
    ]);
    setDistricts(districtRes.data);
    setFilterOptions(filterRes.data);
    return districtRes.data;
  };

  const loadDna = async (district: string, nextFilters = filters) => {
    if (!district) return;
    try {
      setLoading(true);
      setError("");
      const response = await riskService.getDistrictDna(district, nextFilters);
      setDna(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load District Risk DNA.";
      setErrorDetail(message);
      try {
        const countResponse = await crimeService.getCrimeCount();
        const count = countResponse.totalRecords ?? countResponse.data?.totalRecords ?? 0;
        setStoredCount(count);
        setError(count > 0 ? "Records found, but Risk DNA API failed." : message);
      } catch {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const loadedDistricts = await loadDistricts();
        const firstDistrict = loadedDistricts[0]?.district || "";
        setSelectedDistrict(firstDistrict);
        if (firstDistrict) await loadDna(firstDistrict);
        else setDna(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load districts.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (loading && !dna) {
    return <StateBlock title="Loading District Risk DNA" message="Calculating explainable district risk from Catalyst Data Store." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock title="Risk engine unavailable" message={error} />
        {errorDetail && (
          <details className="rounded-md border border-command-700 bg-command-900/85 p-4 text-sm text-slate-300">
            <summary className="cursor-pointer font-semibold text-white">Debug details</summary>
            <p className="mt-3 whitespace-pre-wrap break-words">{errorDetail}</p>
            {storedCount !== null && <p className="mt-2 text-command-300">crime-api count result: {storedCount.toLocaleString()} stored records.</p>}
          </details>
        )}
        <button className="rounded-md bg-command-500 px-4 py-3 font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadDna(selectedDistrict)} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (districts.length === 0) {
    return <StateBlock title="No crime data available" message="Upload CSV records first to generate District Risk DNA." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">District Risk DNA</p>
          <h1 className="text-3xl font-semibold text-white">Explainable District Risk Score Engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Rule-based district profiling using Catalyst Data Store aggregations. No generative AI is used in this step.
          </p>
        </div>
        <button
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800"
          onClick={() => loadDna(selectedDistrict)}
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Risk DNA
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">District Selector</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectFilter
            label="District"
            value={selectedDistrict}
            options={districts.map((district) => district.district)}
            onChange={(value) => {
              setSelectedDistrict(value);
              loadDna(value);
            }}
          />
          <SelectFilter label="FIR Year" value={filters.fir_year} options={filterOptions.years} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={filterOptions.months} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={filterOptions.crimeTypes} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={filterOptions.severities} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={filterOptions.statuses} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadDna(selectedDistrict)} type="button">
            Apply Filters
          </button>
          <button
            className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850"
            onClick={() => {
              const cleared = { fir_year: "", fir_month: "", crime_type: "", severity: "", fir_stage: "" };
              setFilters(cleared);
              loadDna(selectedDistrict, cleared);
            }}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {!dna ? (
        <StateBlock title="No district records found" message="No crime data matched the selected district and filters." />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <RiskGauge score={dna.risk_score} level={dna.risk_level} />
            <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-command-300">{dna.district}</p>
                  <h2 className="text-2xl font-semibold text-white">District Risk Card</h2>
                </div>
                <span className={`rounded border px-3 py-2 text-sm font-semibold ${riskColor[dna.risk_level]}`}>
                  {dna.risk_level} Risk
                </span>
              </div>
              <div className="stat-grid mt-5">
                <DashboardCard title="Dominant Crime Type" value={dna.dominant_crime_type} icon={ShieldAlert} tone="orange" />
                <DashboardCard title="Dominant Crime Head" value={dna.dominant_crime_head} icon={ShieldAlert} />
                <DashboardCard title="Total Crimes" value={dna.total_crimes} icon={AlertTriangle} tone="red" />
                <DashboardCard title="Heinous Crimes" value={dna.heinous_crimes} icon={Crosshair} tone="red" />
                <DashboardCard title="Non-Heinous Crimes" value={dna.non_heinous_crimes} icon={CheckCircle2} tone="green" />
                <DashboardCard title="Peak Crime Month" value={dna.peak_month} icon={TrendingUp} />
                <DashboardCard title="Top Police Station" value={dna.top_police_station} icon={ShieldAlert} />
                <DashboardCard title="Trend Direction" value={dna.trend_direction} icon={dna.trend_direction === "Decreasing" ? TrendingDown : TrendingUp} tone={dna.trend_direction === "Increasing" ? "red" : "green"} />
                <DashboardCard title="Confidence Score" value={`${dna.confidence_score}%`} icon={Brain} tone="green" />
                <DashboardCard title="Arrest Rate" value={`${dna.arrest_rate}%`} icon={CheckCircle2} />
                <DashboardCard title="Coordinate Availability" value={`${dna.coordinate_available_percentage}%`} icon={Crosshair} />
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <BulletPanel title="Why This Risk?" items={dna.why_this_risk} />
            <BulletPanel title="Recommended Police Actions" items={dna.recommendations} />
          </div>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">Crime DNA Profile</h2>
            <div className="stat-grid mt-4">
              <DashboardCard title="Victim Count" value={dna.victim_count} icon={AlertTriangle} tone="orange" />
              <DashboardCard title="Accused Count" value={dna.accused_count} icon={ShieldAlert} tone="red" />
              <DashboardCard title="Arrested Count" value={dna.arrested_count} icon={CheckCircle2} />
              <DashboardCard title="Conviction Count" value={dna.conviction_count} icon={CheckCircle2} tone="green" />
              <DashboardCard title="Conviction Rate" value={`${dna.conviction_rate}%`} icon={CheckCircle2} tone="green" />
              <DashboardCard title="Coordinate Availability" value={`${dna.coordinate_available_percentage}%`} icon={Crosshair} />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <RankingBarChart title="Top 5 Crime Groups" data={dna.top_crime_groups} />
            <RankingBarChart title="Top 5 Crime Heads" data={dna.top_crime_heads} color="#f97316" />
            <MonthlyTrendChart data={dna.monthly_trend} />
            <RankingBarChart title="Police Station Ranking" data={dna.police_station_ranking} color="#38bdf8" />
            <DistributionPieChart title="FIR Stage Distribution" data={dna.fir_stage_distribution} />
            <DistributionPieChart title="Complaint Mode Distribution" data={dna.complaint_mode_distribution} />
          </div>

          <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
            <h2 className="text-base font-semibold text-white">District Crime Twin</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Object.entries(dna.district_crime_twin).map(([key, value]) => (
                <div key={key} className="rounded border border-command-700 bg-command-850 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-command-300">{key.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default DistrictRiskDna;
