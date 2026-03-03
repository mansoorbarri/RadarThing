import { useRef, useState, useCallback } from "react";
import { toPng, toBlob } from "html-to-image";

export function useFlightCardExport() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const waitForFonts = async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  };

  const downloadPng = useCallback(async (filename: string) => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      await waitForFonts();
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      await waitForFonts();
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      if (!blob) throw new Error("Failed to generate image");

      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        return true;
      }

      // Fallback: download instead
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "flight-card.png";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { cardRef, isGenerating, downloadPng, copyToClipboard };
}
