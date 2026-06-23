import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { ANIM } from "../../animations/tokens";
import { useReducedMotion } from "../../animations/useReducedMotion";

interface PageTransitionProps { children: ReactNode; pageKey: string; }
const PageTransition = ({ children, pageKey }: PageTransitionProps) => {
  const reducedMotion = useReducedMotion();
  const previousKey = useRef(pageKey);
  const [rendered, setRendered] = useState(children);
  const [phase, setPhase] = useState<"entered" | "leaving" | "entering">("entered");
  useEffect(() => {
    if (previousKey.current === pageKey) return;
    previousKey.current = pageKey;
    if (reducedMotion) { setRendered(children); setPhase("entered"); return; }
    setPhase("leaving");
    const timeout = window.setTimeout(() => { setRendered(children); setPhase("entering"); requestAnimationFrame(() => setPhase("entered")); }, ANIM.duration.slow);
    return () => window.clearTimeout(timeout);
  }, [children, pageKey, reducedMotion]);
  const style: CSSProperties = { opacity: phase === "entered" ? 1 : 0, transform: phase === "leaving" ? "translateY(-12px)" : phase === "entering" ? "translateY(12px)" : "translateY(0)", transition: reducedMotion ? "none" : `opacity ${ANIM.duration.slow}ms ${ANIM.ease.out}, transform ${ANIM.duration.slow}ms ${ANIM.ease.out}` };
  return <div style={style}>{rendered}</div>;
};

export default PageTransition;
