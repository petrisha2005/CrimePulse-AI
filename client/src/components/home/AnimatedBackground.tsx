import { useEffect, useRef } from "react";

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: "cyan" | "red" | "white";
  phase: number;
}

const dataWords = ["IPC-379", "FIR-2024", "BENGALURU", "MYSURU", "HIGH RISK", "ANOMALY", "CASE COUNT", "HOTSPOT"];

const alertBadges = [
  { label: "HIGH RISK", className: "left-[12%] top-[18%] animation-delay-0" },
  { label: "ALERT", className: "right-[16%] top-[22%] animation-delay-700" },
  { label: "ANOMALY DETECTED", className: "left-[8%] bottom-[28%] animation-delay-1400" },
  { label: "RED ZONE", className: "right-[10%] bottom-[22%] animation-delay-2100" },
  { label: "HOTSPOT", className: "left-[46%] top-[12%] animation-delay-2800" }
];

const signalRings = [
  "left-[18%] top-[62%] border-command-300 animation-delay-0",
  "right-[24%] top-[48%] border-alert-critical animation-delay-1000",
  "left-[62%] bottom-[18%] border-command-300 animation-delay-2000"
];

const streamColumns = [
  "left-3 top-0",
  "left-20 top-8 hidden sm:block",
  "right-4 top-0",
  "right-24 top-16 hidden lg:block"
];

const nodeColor = (color: NodePoint["color"], alpha: number) => {
  if (color === "red") return `rgba(255,45,45,${alpha})`;
  if (color === "white") return `rgba(255,255,255,${alpha})`;
  return `rgba(0,212,255,${alpha})`;
};

const createNodes = (width: number, height: number): NodePoint[] =>
  Array.from({ length: 18 }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    size: 1.8 + Math.random() * 2.8,
    color: index % 5 === 0 ? "red" : index % 4 === 0 ? "white" : "cyan",
    phase: Math.random() * Math.PI * 2
  }));

const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const nodesRef = useRef<NodePoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      nodesRef.current = createNodes(width, height);
    };

    const drawGrid = (time: number) => {
      const offset = (time * 0.012) % 48;
      context.save();
      context.globalAlpha = 0.65 + Math.sin(time * 0.001) * 0.12;
      context.strokeStyle = "rgba(0,212,255,0.08)";
      context.lineWidth = 1;
      for (let x = -48 + offset; x < width + 48; x += 48) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = -48 + offset; y < height + 48; y += 48) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.fillStyle = "rgba(255,45,45,0.035)";
      context.fillRect(width * 0.12, height * 0.22, 110, 72);
      context.fillRect(width * 0.72, height * 0.18, 130, 84);
      context.fillRect(width * 0.58, height * 0.68, 150, 90);
      context.restore();
    };

    const drawRadar = (time: number) => {
      const radius = Math.min(width, height) * 0.22;
      const x = width * 0.72;
      const y = height * 0.42;
      const angle = (time / 4000) * Math.PI * 2;

      context.save();
      context.translate(x, y);
      context.strokeStyle = "rgba(0,212,255,0.18)";
      context.lineWidth = 1;
      [0.28, 0.5, 0.72, 1].forEach((scale) => {
        context.beginPath();
        context.arc(0, 0, radius * scale, 0, Math.PI * 2);
        context.stroke();
      });

      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, "rgba(0,212,255,0.24)");
      gradient.addColorStop(0.55, "rgba(0,212,255,0.08)");
      gradient.addColorStop(1, "rgba(0,212,255,0)");
      context.rotate(angle);
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, -0.06, 0.5);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = "rgba(0,212,255,0.55)";
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(radius, 0);
      context.stroke();
      context.restore();

      const pulse = 0.5 + Math.sin(angle) * 0.5;
      context.save();
      context.fillStyle = `rgba(255,45,45,${0.42 + pulse * 0.45})`;
      context.shadowColor = "#ff2d2d";
      context.shadowBlur = 24 + pulse * 18;
      context.beginPath();
      context.arc(x, y, 4 + pulse * 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawNetwork = (time: number) => {
      const nodes = nodesRef.current;
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      });

      context.save();
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 180) {
            const fade = (1 - distance / 180) * (0.18 + Math.sin(time * 0.0015 + i + j) * 0.08);
            context.strokeStyle = `rgba(0,212,255,${Math.max(0.02, fade)})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      nodes.forEach((node) => {
        const intensity = 0.42 + Math.sin(time * 0.004 + node.phase) * 0.28;
        context.fillStyle = nodeColor(node.color, intensity);
        context.shadowColor = node.color === "red" ? "#ff2d2d" : node.color === "cyan" ? "#00d4ff" : "#ffffff";
        context.shadowBlur = node.color === "red" ? 18 : 12;
        context.beginPath();
        context.arc(node.x, node.y, node.size + intensity * 1.5, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    };

    const render = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#040b14";
      context.fillRect(0, 0, width, height);
      drawGrid(time);
      drawNetwork(time);
      drawRadar(time);
      frameRef.current = window.requestAnimationFrame(render);
    };

    resize();
    frameRef.current = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-[#040b14]" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(0,212,255,0.16),transparent_32%),radial-gradient(circle_at_76%_42%,rgba(255,45,45,0.12),transparent_28%),linear-gradient(180deg,rgba(4,11,20,0.2),rgba(4,11,20,0.86))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,11,20,0.86),transparent_22%,transparent_78%,rgba(4,11,20,0.86))]" />

      {streamColumns.map((position, columnIndex) => (
        <div key={position} className={`crime-data-stream absolute ${position} w-28 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00ff88]/15`}>
          <div className={`crime-data-stream-inner ${columnIndex % 2 === 0 ? "" : "animation-delay-2000"}`}>
            {Array.from({ length: 4 }).map((_, groupIndex) => (
              <div key={`${position}-${groupIndex}`} className="space-y-4 py-3">
                {dataWords.map((word) => <p key={`${position}-${groupIndex}-${word}`}>{word}</p>)}
              </div>
            ))}
          </div>
        </div>
      ))}

      {alertBadges.map((badge) => (
        <div key={badge.label} className={`crime-floating-alert absolute rounded border border-alert-critical/40 bg-alert-critical/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-alert-critical shadow-[0_0_22px_rgba(255,45,45,0.22)] ${badge.className}`}>
          {badge.label}
        </div>
      ))}

      {signalRings.map((ring) => (
        <div key={ring} className={`crime-signal-ring absolute h-20 w-20 rounded-full border ${ring}`} />
      ))}
    </div>
  );
};

export default AnimatedBackground;
