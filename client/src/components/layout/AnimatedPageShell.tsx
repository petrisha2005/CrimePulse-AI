import type { ReactNode } from "react";
import { MotionSection } from "../animation";
import PageBackground, { type PageBackgroundVariant } from "./PageBackground";

interface AnimatedPageShellProps { children: ReactNode; title?: string; eyebrow?: string; backgroundVariant?: PageBackgroundVariant; }
const AnimatedPageShell = ({ children, title, eyebrow, backgroundVariant = "default" }: AnimatedPageShellProps) => <div className="relative isolate min-h-full"><PageBackground variant={backgroundVariant}/><div className="relative z-10">{title && <MotionSection className="mb-6"><p className="text-sm uppercase tracking-[0.18em] text-command-300">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold text-white">{title}</h1></MotionSection>}{children}</div></div>;
export default AnimatedPageShell;
