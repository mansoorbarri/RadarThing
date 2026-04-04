// hooks/useMobileDetection.ts
import { useState, useEffect } from "react";

export const useMobileDetection = (breakpoint = 1024) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isNarrow = window.innerWidth < breakpoint;
      const isTablet =
        window.innerWidth < 1400 &&
        (navigator.maxTouchPoints > 1 ||
          window.matchMedia("(pointer: coarse)").matches);
      setIsMobile(isNarrow || isTablet);
    };

    checkMobile(); // Initial check
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
};
