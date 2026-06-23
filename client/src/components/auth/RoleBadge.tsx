import type { UserRole } from "../../auth/users";

const tones: Record<UserRole, string> = { super_admin: "border-alert-critical/50 bg-alert-critical/10 text-alert-critical", district_officer: "border-alert-high/50 bg-alert-high/10 text-alert-high", station_officer: "border-command-500/50 bg-command-500/10 text-command-300", crime_analyst: "border-alert-low/50 bg-alert-low/10 text-alert-low" };

const RoleBadge = ({ role, label }: { role: UserRole; label: string }) => <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${tones[role]}`}>{label}</span>;

export default RoleBadge;
