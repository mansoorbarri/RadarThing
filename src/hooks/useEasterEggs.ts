import { useEffect } from "react";
import {
  useKonamiCode,
  enableKeyboardEasterEggs,
  injectRainbowRadar,
  enableNightOps,
  showNewYearMessage,
  ENABLE_EASTER_EGGS,
} from "~/lib/easter-eggs";

export function useEasterEggs() {
  useKonamiCode(() => {
    injectRainbowRadar();
    enableNightOps();
  });

  useEffect(() => {
    if (!ENABLE_EASTER_EGGS) return;
    enableKeyboardEasterEggs();
    showNewYearMessage();
  }, []);
}