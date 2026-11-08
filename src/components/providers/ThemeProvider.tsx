"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    // RadarThing is dark everywhere. The app pages used to follow the OS
    // theme while the marketing pages were always dark, so light-mode users
    // saw the theme flip as they navigated. Forcing dark keeps it consistent.
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
