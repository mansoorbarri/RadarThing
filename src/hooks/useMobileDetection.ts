// hooks/useMobileDetection.ts
import { useState, useEffect, useLayoutEffect } from "react";

// Layout effects run before the first paint, so phones don't flash the desktop
// layout after hydration. Fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DeviceType = "phone" | "tablet" | "desktop";

const isTouchDevice = () =>
  navigator.maxTouchPoints > 1 ||
  window.matchMedia("(pointer: coarse)").matches;

export const useMobileDetection = (breakpoint = 1024) => {
  const [isMobile, setIsMobile] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const checkMobile = () => {
      const isNarrow = window.innerWidth < breakpoint;
      const isTablet = window.innerWidth < 1400 && isTouchDevice();
      setIsMobile(isNarrow || isTablet);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
};

export const useDeviceType = (): DeviceType => {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useIsomorphicLayoutEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const touch = isTouchDevice();

      if (w < 768 || (w < 1024 && touch)) {
        setDeviceType("phone");
      } else if ((w >= 768 && w < 1400 && touch) || (w >= 1024 && w < 1200)) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return deviceType;
};
