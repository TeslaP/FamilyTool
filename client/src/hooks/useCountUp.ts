import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration: number = 1200): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const prevTarget = useRef(target);

  useEffect(() => {
    // Reset when target changes
    prevTarget.current = target;
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a gentle settle
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}
