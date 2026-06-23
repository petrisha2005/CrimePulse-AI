import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ReactNode } from "react";
import type { ChartDatum, MonthlyTrend, YearlyTrend } from "../types/crime";
import StateBlock from "./StateBlock";
import { MotionSection } from "./animation";

const palette = ["#2e8bd8", "#ef4444", "#f97316", "#22c55e", "#facc15", "#83c5ff"];
const compactLabel = (value: unknown) => {
  const label = String(value ?? "");
  return label.length > 16 ? `${label.slice(0, 15)}...` : label;
};

interface PanelProps {
  title: string;
  children: ReactNode;
}

const tooltipStyle = { background: "#1E293B", border: "1px solid rgba(0,245,255,0.2)", borderRadius: "6px", color: "#E2E8F0", fontSize: "12px" };
const axisTick = { fill: "#64748B", fontSize: 11 };

const Panel = ({ title, children }: PanelProps) => (
  <MotionSection className="chart-motion-section">
  <section className="card-safe rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-safe truncate-2 text-base font-semibold text-white" title={title}>{title}</h2>
    <div className="chart-safe mt-4 h-72">{children}</div>
  </section>
  </MotionSection>
);

export const DistributionPieChart = ({ title, data }: { title: string; data: ChartDatum[] }) => (
  <Panel title={title}>
    {data.length === 0 ? (
      <StateBlock title="No distribution data" message="This chart will update after matching records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const RankingBarChart = ({ title, data, color = "#2e8bd8" }: { title: string; data: ChartDatum[]; color?: string }) => (
  <Panel title={title}>
    {data.length === 0 ? (
      <StateBlock title="No ranking data" message="This ranking will update after matching records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={axisTick} tickFormatter={compactLabel} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const CrimeTypePieChart = ({ data }: { data: ChartDatum[] }) => (
  <Panel title="Crime Type Distribution">
    {data.length === 0 ? (
      <StateBlock title="No crime types" message="Distribution will appear after records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const MonthlyTrendChart = ({ data }: { data: MonthlyTrend[] }) => (
  <Panel title="Monthly Crime Trend">
    {data.length === 0 ? (
      <StateBlock title="No monthly trend" message="Trend analysis will appear after records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={axisTick} tickFormatter={compactLabel} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="crimes" stroke="#83c5ff" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const YearlyTrendChart = ({ data }: { data: YearlyTrend[] }) => (
  <Panel title="Year-wise Crime Trend">
    {data.length === 0 ? (
      <StateBlock title="No yearly trend" message="Trend analysis will appear after records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={axisTick} tickFormatter={compactLabel} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="crimes" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const DistrictRankingChart = ({ data }: { data: ChartDatum[] }) => (
  <Panel title="District-wise Crime Count">
    {data.length === 0 ? (
      <StateBlock title="No district ranking" message="District counts will appear after records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={axisTick} tickFormatter={compactLabel} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#2e8bd8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Panel>
);

export const FirStageChart = ({ data }: { data: ChartDatum[] }) => (
  <Panel title="Cases by FIR Stage">
    {data.length === 0 ? (
      <StateBlock title="No FIR stages" message="FIR stage analysis will appear after records are available." />
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={axisTick} tickFormatter={compactLabel} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Panel>
);
