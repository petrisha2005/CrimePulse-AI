import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CloudSun, RefreshCw, ShieldAlert, Target, Timer, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DistributionPieChart } from "../components/ChartPanel";
import DashboardCard from "../components/DashboardCard";
import StateBlock from "../components/StateBlock";
import { crimeService } from "../services/crimeService";
import { forecastService } from "../services/forecastService";
import type { CrimeForecast, CrimeTypeForecast, ForecastFilterOptions, ForecastFilters, ForecastRecommendation, ForecastRiskCalendarItem, ForecastSummary } from "../types/crime";

const emptyFilters: ForecastFilters = { district: "All", police_station: "All", crime_type: "All", fir_year: "All", fir_month: "All", severity: "All", fir_stage: "All" };
const emptyOptions: ForecastFilterOptions = { districts: [], policeStations: [], crimeTypes: [], years: [], months: [], severities: [], statuses: [] };

const riskClass = {
  Low: "border-alert-low/50 bg-alert-low/10 text-alert-low",
  Medium: "border-alert-medium/50 bg-alert-medium/10 text-alert-medium",
  High: "border-alert-high/50 bg-alert-high/10 text-alert-high",
  Critical: "border-alert-critical/50 bg-alert-critical/10 text-alert-critical"
};

const SelectFilter = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
    {label}
    <select className="mt-2 min-h-11 w-full rounded-md border border-command-700 bg-command-850 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-command-300" value={value || "All"} onChange={(event) => onChange(event.target.value)}>
      <option value="All">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const optionList = (options: ForecastFilterOptions, primary: keyof ForecastFilterOptions, fallback?: keyof ForecastFilterOptions) => {
  const primaryValue = options[primary];
  const fallbackValue = fallback ? options[fallback] : undefined;
  return (Array.isArray(primaryValue) ? primaryValue : Array.isArray(fallbackValue) ? fallbackValue : []) as string[];
};

const getStoredCount = async () => {
  const response = await crimeService.getCrimeCount();
  return response.totalRecords ?? response.data?.totalRecords ?? 0;
};

const ForecastCard = ({ title, forecast }: { title: string; forecast: CrimeForecast | null }) => (
  <section className={`rounded-md border bg-command-900/85 p-5 shadow-glow ${forecast?.risk_level === "Critical" ? "animate-pulse border-alert-critical/70" : "border-command-700"}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-command-300">{title}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{forecast?.district || "No forecast"}</h2>
      </div>
      {forecast && <span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[forecast.risk_level]}`}>{forecast.risk_level}</span>}
    </div>
    {forecast ? (
      <>
        <div className="mt-5 flex items-end gap-3">
          <span className="text-5xl font-semibold text-white">{forecast.risk_score}</span>
          <span className="pb-2 text-sm text-slate-400">/ 100 risk</span>
        </div>
        <p className="mt-4 text-sm text-slate-300">{forecast.main_reason}</p>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="rounded border border-command-700 bg-command-850 p-3 text-slate-300">Expected: <span className="text-white">{forecast.expected_crime_types.join(", ") || "No dominant type"}</span></div>
          <div className="rounded border border-command-700 bg-command-850 p-3 text-slate-300">Peak: <span className="text-white">{forecast.peak_risk_period}</span></div>
          <div className="rounded border border-command-700 bg-command-850 p-3 text-command-300">{forecast.recommended_action}</div>
        </div>
      </>
    ) : <p className="mt-4 text-sm text-slate-400">No forecast data available.</p>}
  </section>
);

const CrimeForecast = () => {
  const [filters, setFilters] = useState<ForecastFilters>(emptyFilters);
  const [options, setOptions] = useState<ForecastFilterOptions>(emptyOptions);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [today, setToday] = useState<CrimeForecast | null>(null);
  const [tomorrow, setTomorrow] = useState<CrimeForecast | null>(null);
  const [nextSeven, setNextSeven] = useState<CrimeForecast[]>([]);
  const [districtForecasts, setDistrictForecasts] = useState<CrimeForecast[]>([]);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeForecast[]>([]);
  const [riskCalendar, setRiskCalendar] = useState<ForecastRiskCalendarItem[]>([]);
  const [recommendations, setRecommendations] = useState<ForecastRecommendation[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<CrimeForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [storedCount, setStoredCount] = useState<number | null>(null);

  const loadForecast = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      setErrorDetail("");
      const [summaryRes, todayRes, tomorrowRes, weekRes, districtsRes, crimeTypeRes, calendarRes, recommendationRes] = await Promise.all([
        forecastService.getSummary(nextFilters),
        forecastService.getToday(nextFilters),
        forecastService.getTomorrow(nextFilters),
        forecastService.getNextSevenDays(nextFilters),
        forecastService.getDistricts(nextFilters),
        forecastService.getCrimeTypes(nextFilters),
        forecastService.getRiskCalendar(nextFilters),
        forecastService.getRecommendations(nextFilters)
      ]);
      setSummary(summaryRes.data);
      setToday(todayRes.data);
      setTomorrow(tomorrowRes.data);
      setNextSeven(weekRes.data);
      setDistrictForecasts(districtsRes.data);
      setCrimeTypes(crimeTypeRes.data);
      setRiskCalendar(calendarRes.data);
      setRecommendations(recommendationRes.data);
      setSelectedDistrict(districtsRes.data.find((item) => item.district === nextFilters.district) || districtsRes.data[0] || null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to load Crime Forecast.";
      setErrorDetail(detail);
      try {
        const count = await getStoredCount();
        setStoredCount(count);
        setError(count > 0 ? `${count.toLocaleString()} records found, but Crime Forecast API failed.` : detail);
      } catch {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStoredCount().then(setStoredCount).catch(() => setStoredCount(null));
    forecastService.getFilters().then((response) => setOptions(response.data)).catch(() => setOptions(emptyOptions));
    loadForecast();
  }, []);

  const updateFilter = (key: keyof ForecastFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (loading) return <StateBlock title="Loading Crime Weather Forecast" message="Calculating rule-based forecast summaries from Catalyst Data Store." />;
  if (error) {
    return (
      <div className="space-y-4">
        <StateBlock
          title="Forecast unavailable"
          message={storedCount && storedCount > 0 ? error : "No crime records could be confirmed. Upload CSV records first to activate Crime Forecast."}
        />
        <div className="rounded-md border border-alert-high/40 bg-command-900/85 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Forecast API debug</p>
          <p className="mt-2">Count API: {storedCount !== null ? "working" : "unavailable"}</p>
          <p>Stored records: {storedCount !== null ? storedCount.toLocaleString() : "Unknown"}</p>
          {errorDetail ? <p className="mt-2 break-words text-alert-high">Details: {errorDetail}</p> : null}
          <button className="mt-4 rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadForecast(filters)} type="button">
            Retry Forecast
          </button>
        </div>
      </div>
    );
  }
  if (!summary || districtForecasts.length === 0) return <StateBlock title="No crime data available" message="Upload CSV records first to activate Crime Weather Forecast." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-command-300">Predictive Crime Weather</p>
          <h1 className="text-3xl font-semibold text-white">Crime Forecast</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Forecasts are risk indicators based on historical crime patterns, not guaranteed future events.</p>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-md border border-command-700 bg-command-850 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-command-800" onClick={() => loadForecast()} type="button">
          <RefreshCw className="h-4 w-4" />
          Refresh Forecast
        </button>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <div className="stat-grid">
          <DashboardCard title="Overall Risk" value={summary.overall_risk_level || summary.today_overall_risk} icon={CloudSun} tone={(summary.overall_risk_level || summary.today_overall_risk) === "Critical" || (summary.overall_risk_level || summary.today_overall_risk) === "High" ? "red" : "green"} />
          <DashboardCard title="Highest Risk District" value={summary.highest_risk_district} icon={Target} tone="orange" />
          <DashboardCard title="Highest Risk Crime" value={summary.highest_risk_crime_type || summary.expected_concern} icon={ShieldAlert} />
          <DashboardCard title="Forecast Confidence" value={`${summary.forecast_confidence}%`} icon={TrendingUp} tone="green" />
          <DashboardCard title="Records Analyzed" value={summary.total_records_analyzed || 0} icon={Timer} />
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Forecast Filters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectFilter label="District" value={filters.district} options={optionList(options, "districts", "district")} onChange={(value) => updateFilter("district", value)} />
          <SelectFilter label="Police Station" value={filters.police_station} options={optionList(options, "policeStations", "police_station")} onChange={(value) => updateFilter("police_station", value)} />
          <SelectFilter label="Crime Type" value={filters.crime_type} options={optionList(options, "crimeTypes", "crime_type")} onChange={(value) => updateFilter("crime_type", value)} />
          <SelectFilter label="FIR Year" value={filters.fir_year} options={optionList(options, "years", "fir_year")} onChange={(value) => updateFilter("fir_year", value)} />
          <SelectFilter label="FIR Month" value={filters.fir_month} options={optionList(options, "months", "fir_month")} onChange={(value) => updateFilter("fir_month", value)} />
          <SelectFilter label="Severity" value={filters.severity} options={optionList(options, "severities", "severity")} onChange={(value) => updateFilter("severity", value)} />
          <SelectFilter label="FIR Stage" value={filters.fir_stage} options={optionList(options, "statuses", "fir_stage")} onChange={(value) => updateFilter("fir_stage", value)} />
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-command-500 px-4 py-3 text-sm font-semibold text-white hover:bg-command-300 hover:text-command-950" onClick={() => loadForecast(filters)} type="button">Apply Filters</button>
          <button className="rounded-md border border-command-700 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-command-850" onClick={() => { setFilters(emptyFilters); loadForecast(emptyFilters); }} type="button">Clear Filters</button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-4">
        <ForecastCard title="Today" forecast={today} />
        <ForecastCard title="Tomorrow" forecast={tomorrow} />
        <ForecastCard title="Next 7 Days" forecast={nextSeven[0] || null} />
        <ForecastCard title="Selected District" forecast={selectedDistrict} />
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Next 7 Days Forecast</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {nextSeven.map((forecast) => (
            <div key={forecast.forecast_id} className="rounded border border-command-700 bg-command-850 p-3 text-sm">
              <p className="font-semibold text-white">{forecast.date_label || forecast.forecast_label}</p>
              <p className="mt-2 text-2xl font-semibold text-command-300">{forecast.risk_score}</p>
              <span className={`mt-2 inline-block rounded border px-2 py-1 text-xs font-semibold ${riskClass[forecast.risk_level]}`}>{forecast.risk_level}</span>
              <p className="mt-2 text-slate-400">{forecast.top_risk_district || forecast.district}</p>
              <p className="text-slate-400">{forecast.top_risk_crime_type || forecast.expected_concern}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">7-Day Risk Forecast</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nextSeven}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="forecast_label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Line dataKey="risk_score" stroke="#ef4444" strokeWidth={3} />
                <Line dataKey="expected_crime_count" stroke="#83c5ff" strokeWidth={2} />
                <Line dataKey="high_severity_probability" stroke="#facc15" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <DistributionPieChart title="Risk Distribution" data={summary.risk_distribution} />
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Crime Type Forecast</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crimeTypes.slice(0, 10)}>
                <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
                <XAxis dataKey="crime_type" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
                <Bar dataKey="risk_score" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Monthly Risk Calendar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {riskCalendar.map((month) => (
            <div key={month.month} className="rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">Month {month.month}</span>
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[month.risk_level]}`}>{month.risk_level}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-command-300">{month.risk_score}</p>
              <p className="mt-1">Volume: {month.predicted_volume}</p>
              <p>Top: {month.top_crime_type}</p>
              <p>{month.top_district}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Crime Forecast Map Summary</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {districtForecasts.slice(0, 12).map((forecast) => (
            <div key={forecast.forecast_id} className={`rounded border p-4 ${forecast.risk_level === "Critical" ? "animate-pulse border-alert-critical/70 bg-alert-critical/10" : "border-command-700 bg-command-850"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">{forecast.district}</p>
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[forecast.risk_level]}`}>{forecast.risk_level}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-command-300">{forecast.risk_score}</p>
              <p className="mt-1 text-xs text-slate-400">{forecast.expected_concern}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">District Forecast Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-command-700 text-left text-sm">
            <thead className="bg-command-850 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3">District</th>
                <th className="px-3 py-3">Risk Score</th>
                <th className="px-3 py-3">Risk Level</th>
                <th className="px-3 py-3">Expected Concern</th>
                <th className="px-3 py-3">Dominant Crime Type</th>
                <th className="px-3 py-3">Forecast Reason</th>
                <th className="px-3 py-3">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-700/70">
              {districtForecasts.slice(0, 50).map((forecast) => (
                <tr key={forecast.forecast_id} className="hover:bg-command-850/70">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-200">{forecast.district}</td>
                  <td className="px-3 py-3 font-semibold text-command-300">{forecast.risk_score}</td>
                  <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs font-semibold ${riskClass[forecast.risk_level]}`}>{forecast.risk_level}</span></td>
                  <td className="px-3 py-3 text-slate-300">{forecast.expected_concern}</td>
                  <td className="px-3 py-3 text-slate-300">{forecast.expected_crime_types.join(", ")}</td>
                  <td className="min-w-72 px-3 py-3 text-slate-300">{forecast.main_reason}</td>
                  <td className="min-w-72 px-3 py-3 text-command-300">{forecast.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDistrict && (
        <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
          <h2 className="text-base font-semibold text-white">Why This Forecast?</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedDistrict.why_this_forecast.map((reason) => (
              <div key={reason} className="flex gap-3 rounded border border-command-700 bg-command-850 p-3 text-sm text-slate-300">
                <AlertTriangle className="h-4 w-4 flex-none text-alert-high" />
                {reason}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
        <h2 className="text-base font-semibold text-white">Operational Recommendations</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((item) => (
            <div key={`${item.title}-${item.district}`} className="rounded border border-command-700 bg-command-850 p-4 text-sm text-slate-300">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-white">{item.title}</p>
                <span className="rounded border border-command-700 px-2 py-1 text-xs text-command-300">{item.priority}</span>
              </div>
              <p className="mt-2">{item.reason}</p>
              <p className="mt-2 text-command-300">{item.action}</p>
              <p className="mt-2 text-xs text-slate-500">{item.district} / {item.crime_type} / {item.confidence_score}% confidence</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CrimeForecast;
