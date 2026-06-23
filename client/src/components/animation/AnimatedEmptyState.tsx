import { type ReactNode } from "react";
import { useReducedMotion } from "../../animations/useReducedMotion";

interface AnimatedEmptyStateProps { icon: ReactNode; title: string; description: string; action?: ReactNode; className?: string; }
const AnimatedEmptyState = ({ icon, title, description, action, className = "" }: AnimatedEmptyStateProps) => {
  const reducedMotion = useReducedMotion();
  return <section className={className} role="status" style={{ position: "relative", overflow: "hidden", padding: 38, textAlign: "center", border: "1px solid rgba(0,245,255,0.12)", borderRadius: 8, background: "rgba(13,17,23,0.82)" }}><style>{`@keyframes motion-empty-float{50%{transform:translateY(-8px)}}@keyframes motion-empty-ring{to{transform:scale(1.4);opacity:0}}`}</style><div style={{ position: "relative", display: "grid", placeItems: "center", width: 64, height: 64, margin: "0 auto" }}><span aria-hidden="true" style={{ position: "absolute", inset: 0, border: "1px solid rgba(0,245,255,0.35)", borderRadius: "50%", animation: reducedMotion ? "none" : "motion-empty-ring 2.5s ease-out infinite" }} /><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 64, height: 64, color: "#00F5FF", animation: reducedMotion ? "none" : "motion-empty-float 3s ease-in-out infinite" }}>{icon}</span></div><h2 style={{ margin: "20px 0 0", color: "#fff", fontSize: 18, fontWeight: 600 }}>{title}</h2><p style={{ maxWidth: 520, margin: "10px auto 0", color: "#64748B", fontSize: 14, lineHeight: 1.6, overflowWrap: "break-word" }}>{description}</p>{action && <div style={{ marginTop: 22 }}>{action}</div>}</section>;
};

export default AnimatedEmptyState;
