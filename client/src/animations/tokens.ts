export const ANIM = {
  duration: { fast: 150, base: 250, slow: 400, cinematic: 700 },
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  },
  glow: {
    cyan: "0 0 20px rgba(0,245,255,0.25), 0 0 60px rgba(0,245,255,0.08)",
    red: "0 0 20px rgba(255,51,102,0.25), 0 0 60px rgba(255,51,102,0.08)",
    purple: "0 0 20px rgba(124,58,237,0.25)"
  },
  colors: { neon: "#00F5FF", alert: "#FF3366", purple: "#7C3AED", dark: "#030712", dark2: "#0D1117", dark3: "#111827", muted: "#64748B" }
} as const;
