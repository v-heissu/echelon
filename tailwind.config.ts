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
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#001437",
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
          DEFAULT: "#D64641",
          foreground: "#FFFFFF",
        },
        positive: "#2D6A4F",
        muted: {
          DEFAULT: "#EAEAEA",
          foreground: "#64748b",
        },
        border: "#B2B8C3",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#001437",
        },
        input: "#B2B8C3",
        ring: "#007AC5",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
