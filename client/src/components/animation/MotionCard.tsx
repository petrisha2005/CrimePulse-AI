import { type CSSProperties, type ReactNode, useState } from "react";
import { ANIM } from "../../animations/tokens";
import { useReducedMotion } from "../../animations/useReducedMotion";

type GlowColor = "cyan" | "red" | "purple";
interface MotionCardProps { children: ReactNode; className?: string; glowColor?: GlowColor; delay?: number; }

const MotionCard = ({ children, className = "", glowColor = "cyan", delay = 0 }: MotionCardProps) => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const transform = reducedMotion ? "none" : pressed ? "scale(0.98)" : hovered ? "translateY(-4px)" : "translateY(0)";
  const style: CSSProperties = { transform, boxShadow: !reducedMotion && hovered ? ANIM.glow[glowColor] : "none", transition: `transform ${ANIM.duration.base}ms ${ANIM.ease.out}, box-shadow ${ANIM.duration.base}ms ${ANIM.ease.out}`, transitionDelay: `${delay}ms` };
  return <div className={className} style={style} onMouseDown={() => setPressed(true)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }} onMouseUp={() => setPressed(false)}>{children}</div>;
};

export default MotionCard;
