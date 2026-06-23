export const formatCompactDateTime = (value?: string) => {
  if (!value) return "No alerts";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No alerts";
  const date = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(parsed);
  return `${date}\n${time}`;
};
