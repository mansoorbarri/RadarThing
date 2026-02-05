import "~/styles/globals.css";
import "leaflet/dist/leaflet.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Suspense } from "react";

import { Toaster } from "sonner";
import { ConvexProvider } from "~/components/providers/ConvexProvider";
import { PostHogProvider } from "~/components/providers/PostHogProvider";
import { ContributorRewardModal } from "~/components/ui/ContributorRewardModal";

export const metadata: Metadata = {
  title: "RadarThing",
  description: "RadarThing for GeoFS",
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
      afterSignOutUrl={"/radar"}
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
          <ConvexProvider>
            <PostHogProvider>
              <ContributorRewardModal />
              <Suspense fallback={null}>
                <Toaster
                  theme="dark"
                  position="top-center"
                  toastOptions={{
                    className:
                      "!bg-black/40 !backdrop-blur-md !border !border-cyan-400/30 !text-white !rounded-sm",
                    classNames: {
                      success:
                        "!bg-black/40 !backdrop-blur-md !border-emerald-500/30 !text-emerald-200",
                      error:
                        "!bg-black/40 !backdrop-blur-md !border-red-500/30 !text-red-200",
                      warning:
                        "!bg-black/40 !backdrop-blur-md !border-yellow-500/30 !text-yellow-200",
                      info: "!bg-black/40 !backdrop-blur-md !border-cyan-400/30 !text-cyan-200",
                    },
                  }}
                />
                {children}
              </Suspense>
            </PostHogProvider>
          </ConvexProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
