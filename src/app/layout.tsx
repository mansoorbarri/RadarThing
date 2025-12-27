import "~/styles/globals.css";
import "leaflet/dist/leaflet.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "~/app/api/uploadthing/core";

export const metadata: Metadata = {
  title: "ATC Radar",
  description: "ATC Radar for GeoFS",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
          appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#22d3ee", // text-cyan-400
          colorBackground: "#010b10", // Your app background
          colorText: "#22d3ee",
          colorInputBackground: "#000000",
          colorInputText: "#ffffff",
        },
        elements: {
          card: "border border-cyan-400/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]",
          navbar: "hidden", // Removes the clerk branding if desired
        },
      }}
    >
    <html lang="en" className={`${geist.variable}`}>
      <body>
      <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        {children}
      </body>
    </html>
    </ClerkProvider>
  );
}
