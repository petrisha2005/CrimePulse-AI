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

const palette = ["#2e8bd8", "#ef4444", "#f97316", "#22c55e", "#facc15", "#83c5ff"];

interface PanelProps {
  title: string;
  children: ReactNode;
}

const Panel = ({ title, children }: PanelProps) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    <div className="mt-4 h-72">{children}</div>
  </section>
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
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis allowDecimals={false} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="month" stroke="#94a3b8" />
          <YAxis allowDecimals={false} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke="#94a3b8" />
          <YAxis allowDecimals={false} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis allowDecimals={false} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
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
          <CartesianGrid stroke="#1e3a55" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis allowDecimals={false} stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#0a1728", border: "1px solid #1e3a55", color: "#fff" }} />
          <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Panel>
);
