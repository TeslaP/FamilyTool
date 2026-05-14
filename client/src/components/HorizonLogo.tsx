import { cn } from "../lib/utils";

interface Props {
  size?: number;
  className?: string;
  variant?: "dark" | "light";
}

export function HorizonLogo({ size = 40, className, variant = "dark" }: Props) {
  const bgColor = variant === "dark" ? "#1c1917" : "rgba(255,255,255,0.2)";
  const strokeColor = variant === "dark" ? "#a8a29e" : "rgba(255,255,255,0.7)";
  const fillColor = variant === "dark" ? "#e8e4de" : "rgba(255,255,255,0.3)";

  return (
    <div
      className={cn("flex items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size, backgroundColor: bgColor }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" fill={fillColor} />
        <line x1="4" y1="17" x2="28" y2="17" stroke={strokeColor} strokeWidth="1.2" />
        <line x1="6" y1="21" x2="26" y2="21" stroke={strokeColor} strokeWidth="1" opacity="0.7" />
        <line x1="9" y1="25" x2="23" y2="25" stroke={strokeColor} strokeWidth="0.8" opacity="0.5" />
        <circle cx="16" cy="16" r="14" fill="none" stroke={strokeColor} strokeWidth="0.8" />
      </svg>
    </div>
  );
}
