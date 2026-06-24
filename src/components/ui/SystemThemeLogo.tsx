"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type SystemThemeLogoProps = Omit<
  React.ComponentProps<typeof Image>,
  "src" | "alt"
> & {
  alt?: string;
};

export function SystemThemeLogo({
  alt = "RadarThing",
  ...props
}: SystemThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Image
      src={resolvedTheme === "light" ? "/logo-black.svg" : "/logo-white.svg"}
      alt={alt}
      {...props}
    />
  );
}
