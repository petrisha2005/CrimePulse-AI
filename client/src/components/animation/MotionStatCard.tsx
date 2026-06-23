import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { ANIM } from "../../animations/tokens";
import { useReducedMotion } from "../../animations/useReducedMotion";
import MotionCard from "./MotionCard";

type GlowColor = "cyan" | "red" | "purple";
interface MotionStatCardProps { label: string; value: number | string; suffix?: string; prefix?: string; glowColor?: GlowColor; icon?: ReactNode; delay?: number; className?: string; }
const palette: Record<GlowColor, string> = { cyan: ANIM.colors.neon, red: ANIM.colors.alert, purple: ANIM.colors.purple };
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const MotionStatCard = ({ label, value, suffix = "", prefix = "", glowColor = "cyan", icon, delay = 0, className = "" }: MotionStatCardProps) => {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(typeof value === "number" && !reducedMotion ? 0 : value);
  useEffect(() => {
    if (typeof value !== "number" || reducedMotion) { setShown(value); return; }
    let frame = 0; let elapsed = 0; let last = performance.now();
    const tick = (now: number) => { elapsed += now - last; last = now; const progress = Math.min(1, elapsed / 1800); setShown(Math.round(value * easeOutCubic(progress))); if (progress < 1 && !document.hidden) frame = requestAnimationFrame(tick); };
    const visibilityHandler = () => { if (!document.hidden && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); } if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } };
    document.addEventListener("visibilitychange", visibilityHandler);
    if (!document.hidden) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibilityHandler); };
  }, [reducedMotion, value]);
  const color = palette[glowColor];
  const cardStyle: CSSProperties = { position: "relative", overflow: "hidden", minWidth: 0, border: "1px solid rgba(0,245,255,0.12)", borderRadius: 8, background: "rgba(255,255,255,0.03)", backdropFilter: "blur(14px)", padding: 18 };
  return <MotionCard className={className} delay={delay} glowColor={glowColor}><style>{`@keyframes motion-stat-shimmer{from{transform:translateX(-120%)}to{transform:translateX(220%)}}`}</style><div style={cardStyle}><span aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "42%", height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animation: reducedMotion ? "none" : "motion-stat-shimmer 3s linear infinite" }} />{icon && <span style={{ position: "absolute", right: 16, top: 16, color }}>{icon}</span>}<p style={{ margin: 0, color: ANIM.colors.muted, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</p><strong style={{ display: "block", marginTop: 13, color, fontFamily: "JetBrains Mono, monospace", fontSize: 30, lineHeight: 1.1, textShadow: `0 0 18px ${color}55` }}>{prefix}{typeof shown === "number" ? shown.toLocaleString() : shown}{suffix}</strong></div></MotionCard>;
};

export default MotionStatCard;
