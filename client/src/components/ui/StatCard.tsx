import type { LucideIcon } from "lucide-react";
import AutoFitText from "./AutoFitText";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "orange" | "red";
  maxValueLines?: 1 | 2 | 3;
  className?: string;
  valueClassName?: string;
}

const toneMap = {
  blue: "border-command-500/40 text-command-300",
  green: "border-alert-low/40 text-alert-low",
  orange: "border-alert-high/40 text-alert-high",
  red: "border-alert-critical/40 text-alert-critical"
};

const StatCard = ({ label, value, subtitle, icon: Icon, tone = "blue", maxValueLines = 3, className = "", valueClassName = "" }: StatCardProps) => (
  <section className={`card-safe flex h-full min-h-[136px] flex-col rounded-md border border-command-700 bg-command-900/85 p-5 shadow-glow ${className}`}>
    <div className="flex min-w-0 items-start justify-between gap-4">
      <AutoFitText value={label} variant="label" maxLines={2} />
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-command-850 ${toneMap[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
    <div className="mt-3 min-w-0">
      <AutoFitText value={value} variant="metric" maxLines={maxValueLines} className={valueClassName} />
    </div>
    {subtitle && <div className="mt-auto pt-2"><AutoFitText value={subtitle} variant="body" maxLines={2} className="text-xs text-slate-500" /></div>}
  </section>
);

export default StatCard;
