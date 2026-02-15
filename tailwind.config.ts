import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#0f172a",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#007AC5",
          light: "#00A4E6",
          foreground: "#FFFFFF",
        },
        teal: {
          DEFAULT: "#008996",
          light: "#33A1AB",
        },
        gold: "#FFC76D",
        orange: "#F58B46",
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        positive: "#2D6A4F",
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b",
        },
        border: "rgba(0, 20, 55, 0.08)",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0f172a",
        },
        input: "#cbd5e1",
        ring: "#007AC5",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0,20,55,0.04), 0 4px 12px rgba(0,20,55,0.03)',
        'card-hover': '0 2px 4px rgba(0,20,55,0.06), 0 8px 24px rgba(0,20,55,0.06)',
        'glow': '0 0 20px rgba(0,122,197,0.15)',
        'glow-lg': '0 0 40px rgba(0,122,197,0.2)',
      },
    },
  },
  plugins: [],
};
export default config;
