import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode, useState } from "react";
import { ANIM } from "../../animations/tokens";
import { useReducedMotion } from "../../animations/useReducedMotion";

type Variant = "primary" | "ghost" | "danger";
interface MotionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> { children: ReactNode; variant?: Variant; className?: string; }
const styles: Record<Variant, CSSProperties> = {
  primary: { background: "linear-gradient(90deg, #00F5FF, #3182f6)", color: "#000", border: "1px solid transparent", boxShadow: "0 0 16px rgba(0,245,255,0.15)" },
  ghost: { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" },
  danger: { background: "rgba(255,51,102,0.08)", color: "#FF7797", border: "1px solid rgba(255,51,102,0.45)" }
};
const glows: Record<Variant, string> = { primary: ANIM.glow.cyan, ghost: "0 0 18px rgba(255,255,255,0.1)", danger: ANIM.glow.red };

const MotionButton = ({ children, variant = "primary", className = "", style, disabled, ...props }: MotionButtonProps) => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const transform = reducedMotion ? "none" : pressed ? "scale(0.96)" : hovered ? "translateY(-2px)" : "translateY(0)";
  const buttonStyle: CSSProperties = { ...styles[variant], ...style, minHeight: 42, padding: "10px 16px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, transform, opacity: disabled ? 0.55 : 1, boxShadow: !reducedMotion && hovered && !disabled ? glows[variant] : styles[variant].boxShadow, transition: `transform ${ANIM.duration.fast}ms ${ANIM.ease.out}, box-shadow ${ANIM.duration.fast}ms ${ANIM.ease.out}`, outlineOffset: 2 };
  return <button {...props} className={className} disabled={disabled} style={buttonStyle} onMouseDown={(event) => { setPressed(true); props.onMouseDown?.(event); }} onMouseEnter={(event) => { setHovered(true); props.onMouseEnter?.(event); }} onMouseLeave={(event) => { setHovered(false); setPressed(false); props.onMouseLeave?.(event); }} onMouseUp={(event) => { setPressed(false); props.onMouseUp?.(event); }}>{children}</button>;
};

export default MotionButton;
