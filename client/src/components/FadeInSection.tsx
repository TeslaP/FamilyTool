import { type ReactNode } from "react";
import { useFadeInOnScroll } from "../hooks/useFadeInOnScroll";
import { cn } from "../lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function FadeInSection({ children, className, delay = 0 }: Props) {
  const { ref, isVisible } = useFadeInOnScroll();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[600ms] ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
