import { type CSSProperties, type ReactNode } from "react";
import { ANIM } from "../../animations/tokens";
import { useInView } from "../../animations/useInView";
import { useReducedMotion } from "../../animations/useReducedMotion";

interface MotionSectionProps { children: ReactNode; className?: string; delay?: number; }
const MotionSection = ({ children, className = "", delay = 0 }: MotionSectionProps) => {
  const reducedMotion = useReducedMotion();
  const [ref, visible] = useInView();
  const revealed = reducedMotion || visible;
  const style: CSSProperties = { opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(24px)", transition: reducedMotion ? "none" : `opacity ${ANIM.duration.cinematic}ms ${ANIM.ease.out} ${delay}ms, transform ${ANIM.duration.cinematic}ms ${ANIM.ease.out} ${delay}ms` };
  return <div className={className} ref={ref} style={style}>{children}</div>;
};

export default MotionSection;
