import { useEffect, useRef, useState } from "react";

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
}

const optionalVideoUrl = import.meta.env.VITE_HOMEPAGE_VIDEO_URL as string | undefined;

const createNodes = (width: number, height: number) => Array.from({ length: 18 }, (_, index): NodePoint => ({
  x: Math.random() * width,
  y: Math.random() * height,
  vx: (Math.random() - 0.5) * 0.12,
  vy: (Math.random() - 0.5) * 0.12,
  radius: index % 6 === 0 ? 2.8 : 1.3 + Math.random() * 1.8,
  phase: Math.random() * Math.PI * 2
}));

const IntelligenceBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const nodesRef = useRef<NodePoint[]>([]);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const nodes = nodesRef.current;
      const radarX = width * 0.79;
      const radarY = height * 0.3;
      const radarRadius = Math.min(width, height) * 0.17;

      context.save();
      context.strokeStyle = "rgba(0, 212, 255, 0.1)";
      context.lineWidth = 1;
      [0.36, 0.64, 1].forEach((scale) => {
        context.beginPath();
        context.arc(radarX, radarY, radarRadius * scale, 0, Math.PI * 2);
        context.stroke();
      });
      const radarAngle = reduceMotion ? 0.4 : (time / 16000) * Math.PI * 2;
      context.translate(radarX, radarY);
      context.rotate(radarAngle);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radarRadius);
      gradient.addColorStop(0, "rgba(0, 212, 255, 0.12)");
      gradient.addColorStop(1, "rgba(0, 212, 255, 0)");
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radarRadius, -0.05, 0.38);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = "rgba(131, 197, 255, 0.28)";
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(radarRadius, 0);
      context.stroke();
      context.restore();

      nodes.forEach((node) => {
        if (!reduceMotion) {
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }
      });

      for (let index = 0; index < nodes.length; index += 1) {
        for (let compare = index + 1; compare < nodes.length; compare += 1) {
          const first = nodes[index];
          const second = nodes[compare];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance < 164) {
            context.strokeStyle = `rgba(0, 212, 255, ${0.035 + (1 - distance / 164) * 0.11})`;
            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }

      nodes.forEach((node) => {
        const pulse = reduceMotion ? 0.7 : 0.52 + Math.sin(time * 0.0016 + node.phase) * 0.22;
        context.fillStyle = `rgba(131, 197, 255, ${pulse})`;
        context.shadowColor = "#00d4ff";
        context.shadowBlur = 10;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
      frameRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    frameRef.current = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="intelligence-background" aria-hidden="true">
      {optionalVideoUrl && !videoFailed && <video className="intelligence-video" autoPlay loop muted playsInline onError={() => setVideoFailed(true)}><source src={optionalVideoUrl} type="video/mp4" /></video>}
      <canvas ref={canvasRef} className="intelligence-canvas" />
      <div className="intelligence-map-outline" />
      <div className="intelligence-fingerprint" />
      <div className="intelligence-cctv-frame" />
      <div className="intelligence-pulse intelligence-pulse-one" />
      <div className="intelligence-pulse intelligence-pulse-two" />
      <div className="intelligence-vignette" />
    </div>
  );
};

export default IntelligenceBackground;
