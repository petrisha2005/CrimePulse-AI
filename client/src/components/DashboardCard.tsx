import type { LucideIcon } from "lucide-react";
import StatCard from "./ui/StatCard";
import { MotionCard } from "./animation";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "blue" | "green" | "orange" | "red";
  valueClassName?: string;
  compactValue?: boolean;
}

const glowForTone = (tone: DashboardCardProps["tone"]) => tone === "red" || tone === "orange" ? "red" : tone === "blue" ? "cyan" : "purple";

const DashboardCard = ({ title, value, icon: Icon, tone = "blue", valueClassName = "", compactValue = false }: DashboardCardProps) => {
  return <MotionCard glowColor={glowForTone(tone)}><StatCard label={title} value={value} icon={Icon} tone={tone} maxValueLines={compactValue ? 2 : 3} valueClassName={valueClassName} /></MotionCard>;
};

export default DashboardCard;
