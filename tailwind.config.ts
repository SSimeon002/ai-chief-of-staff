import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          950: "#0b0d10",
          900: "#11141a",
          800: "#181c24",
          700: "#232936",
          600: "#2e3645",
          500: "#475065",
          400: "#7a8497",
          300: "#a8b0bf",
          200: "#cdd2dc",
          100: "#e7eaef",
          50: "#f5f7fa",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,18,25,0.04), 0 8px 24px rgba(15,18,25,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
