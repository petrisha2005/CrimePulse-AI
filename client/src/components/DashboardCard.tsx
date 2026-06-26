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

const helpTextFor = (title: string) => {
  const normalized = title.toLowerCase();
  if (normalized.includes("risk score")) return "A 0-100 indicator based on crime volume, severity, trend, concentration, and outcome gaps.";
  if (normalized.includes("data quality")) return "How complete the key FIR fields are, with coordinate coverage contributing to the score.";
  if (normalized.includes("coordinate availability")) return "The share of records with usable latitude and longitude. Missing coordinates use district-level fallback where supported.";
  if (normalized.includes("heinous")) return "High-severity crime records identified from the uploaded FIR classification.";
  if (normalized.includes("conviction gap")) return "A signal that compares recorded accused, arrests, and convictions to highlight case follow-up needs.";
  if (normalized.includes("pattern confidence")) return "How strongly the available records support the detected repeated pattern.";
  if (normalized.includes("forecast risk")) return "A historical risk indicator for planning. It is not a prediction of an individual incident.";
  return undefined;
};

const DashboardCard = ({ title, value, icon: Icon, tone = "blue", valueClassName = "", compactValue = false }: DashboardCardProps) => {
  return <MotionCard glowColor={glowForTone(tone)}><StatCard label={title} value={value} icon={Icon} tone={tone} maxValueLines={compactValue ? 2 : 3} valueClassName={valueClassName} helpText={helpTextFor(title)} /></MotionCard>;
};

export default DashboardCard;
