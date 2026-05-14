import { cn } from "../lib/utils";

interface Props {
  size?: number;
  className?: string;
  mode?: "draw" | "breathe" | "both";
}

export function HorizonLogoAnimated({ size = 48, className, mode = "both" }: Props) {
  const r = 14; // circle radius
  const circumference = 2 * Math.PI * r;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <style>{`
        @keyframes drawCircle {
          from { stroke-dashoffset: ${circumference}; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInLine {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .horizon-draw-circle {
          stroke-dasharray: ${circumference};
          stroke-dashoffset: ${circumference};
          animation: drawCircle 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .horizon-line-1 { opacity: 0; animation: fadeInLine 0.5s ease-out 0.6s forwards; }
        .horizon-line-2 { opacity: 0; animation: fadeInLine 0.5s ease-out 0.8s forwards; }
        .horizon-line-3 { opacity: 0; animation: fadeInLine 0.5s ease-out 1.0s forwards; }
        .horizon-breathe {
          animation: breathe 3s ease-in-out infinite;
          animation-delay: 1.2s;
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={mode === "breathe" || mode === "both" ? "horizon-breathe" : ""}
      >
        {/* Circle - draws itself */}
        <circle
          cx="16" cy="16" r={r}
          stroke="#a8a29e"
          strokeWidth="1"
          fill="#e8e4de"
          fillOpacity="0.3"
          className={mode === "draw" || mode === "both" ? "horizon-draw-circle" : ""}
        />
        {/* Horizon lines - fade in staggered */}
        <line x1="4" y1="17" x2="28" y2="17" stroke="#78716c" strokeWidth="1.2" className="horizon-line-1" />
        <line x1="7" y1="21" x2="25" y2="21" stroke="#a8a29e" strokeWidth="1" className="horizon-line-2" />
        <line x1="10" y1="25" x2="22" y2="25" stroke="#d6d3d1" strokeWidth="0.8" className="horizon-line-3" />
      </svg>
    </div>
  );
}
