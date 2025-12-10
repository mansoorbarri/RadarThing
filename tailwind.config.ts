import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      keyframes: {
        radarPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0,255,255,0.5)" },
          "50%": { boxShadow: "0 0 16px rgba(0,255,255,0.9)" },
        },
      },
      animation: {
        radarPulse: "radarPulse 1.6s ease-in-out infinite",
      },
    },
  },
  content: [
    "./src/**/*.{ts,tsx}", // make sure Tailwind checks all components / pages
  ],
  plugins: [],
};

export default config;