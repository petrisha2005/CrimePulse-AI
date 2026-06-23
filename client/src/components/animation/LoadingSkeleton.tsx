import { type CSSProperties } from "react";
import { useReducedMotion } from "../../animations/useReducedMotion";

interface LoadingSkeletonProps { lines?: number; height?: number; className?: string; }
const LoadingSkeleton = ({ lines = 3, height = 14, className = "" }: LoadingSkeletonProps) => {
  const reducedMotion = useReducedMotion();
  const lineStyle: CSSProperties = { height, borderRadius: 6, background: "rgba(255,255,255,0.06)", backgroundImage: reducedMotion ? "none" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", backgroundSize: "200% 100%", animation: reducedMotion ? "none" : "motion-skeleton-shimmer 1.8s linear infinite" };
  return <div className={className} aria-busy="true" aria-label="Loading"><style>{`@keyframes motion-skeleton-shimmer{to{background-position:-200% 0}}`}</style>{Array.from({ length: lines }, (_, index) => <div key={index} style={{ ...lineStyle, marginTop: index ? 10 : 0, width: index === lines - 1 ? "72%" : "100%" }} />)}</div>;
};

export default LoadingSkeleton;
