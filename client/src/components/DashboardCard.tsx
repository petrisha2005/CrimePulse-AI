import type { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "blue" | "green" | "orange" | "red";
}

const toneMap = {
  blue: "border-command-500/40 text-command-300",
  green: "border-alert-low/40 text-alert-low",
  orange: "border-alert-high/40 text-alert-high",
  red: "border-alert-critical/40 text-alert-critical"
};

const DashboardCard = ({ title, value, icon: Icon, tone = "blue" }: DashboardCardProps) => (
  <section className="rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-400">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded border bg-command-850 ${toneMap[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </section>
);

export default DashboardCard;
