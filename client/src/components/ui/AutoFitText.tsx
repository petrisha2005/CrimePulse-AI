interface AutoFitTextProps {
  value: string | number;
  variant?: "title" | "metric" | "label" | "body";
  maxLines?: 1 | 2 | 3;
  className?: string;
  title?: string;
}

const metricSize = (length: number) => {
  if (length <= 12) return "metric-value-lg";
  if (length <= 24) return "metric-value-md";
  if (length <= 40) return "metric-value-sm";
  return "metric-value-xs";
};

const AutoFitText = ({ value, variant = "body", maxLines = 2, className = "", title }: AutoFitTextProps) => {
  const text = String(value ?? "");
  const lineClamp = `line-clamp-${maxLines}-custom`;
  const base = variant === "metric"
    ? `metric-value-auto ${metricSize(text.length)}`
    : variant === "label"
      ? "text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
      : variant === "title"
        ? "text-base font-semibold text-white"
        : "text-sm text-slate-300";

  return <span className={`auto-fit-text text-safe no-break-all ${lineClamp} ${base} ${className}`} title={title || text}>{text}</span>;
};

export default AutoFitText;
