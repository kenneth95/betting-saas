import type { Config } from "tailwindcss";

const config: Config = {
  // lib/ is scanned too: lib/business.ts exports class strings (pageShell).
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#0F2419",
          800: "#16301F",
          700: "#1E3D28",
        },
        chalk: "#F3F1E8",
        sage: "#7F9C87",
        amber: "#E3A23D",
      },
      fontFamily: {
        display: ["var(--font-oswald)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
