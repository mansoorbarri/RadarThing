"use client";

import Image from "next/image";
import { useTheme } from "next-themes";

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

  return (
    <Image
      src={resolvedTheme === "light" ? "/logo-black.svg" : "/logo-white.svg"}
      alt={alt}
      {...props}
    />
  );
}
