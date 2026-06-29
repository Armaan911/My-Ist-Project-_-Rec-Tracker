import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // CGIT palette — brand stays blue/red in both themes; neutrals + tints flip via
        // CSS variables (light in :root, dark in .dark — see globals.css).
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        brand: { 25: "#F1F8FD", 50: "rgb(var(--c-brand-50) / <alpha-value>)", 100: "#C2E2F4", 200: "#92CBEC", 500: "#2497DA", 600: "#068AD3", 700: "rgb(var(--c-brand-700) / <alpha-value>)", 800: "#1C375D" },
        accent: { 50: "rgb(var(--c-accent-50) / <alpha-value>)", 500: "#F30000", 600: "#D10908" },
        success: { 50: "rgb(var(--c-success-50) / <alpha-value>)", 600: "#0E9F6E" },
        warning: { 50: "rgb(var(--c-warning-50) / <alpha-value>)", 600: "#B7791F" },
        danger: { 50: "rgb(var(--c-danger-50) / <alpha-value>)", 600: "#D63030" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(23,23,31,0.05)",
        card: "0 1px 2px rgba(23,23,31,0.04), 0 1px 3px rgba(23,23,31,0.06)",
        md: "0 2px 4px rgba(23,23,31,0.04), 0 4px 12px rgba(23,23,31,0.08)",
        lg: "0 8px 16px rgba(23,23,31,0.06), 0 16px 32px rgba(23,23,31,0.10)",
        pop: "0 8px 24px rgba(23,23,31,0.10)",
        ring: "0 0 0 4px rgba(6,138,211,0.16)",
      },
      borderRadius: { xl: "14px", "2xl": "18px", "3xl": "24px" },
      transitionTimingFunction: { spring: "cubic-bezier(0.22, 1, 0.36, 1)" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(0.96)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pop-in": { "0%": { transform: "scale(0.8)", opacity: "0" }, "60%": { transform: "scale(1.05)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        "toast-in": { "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" }, "100%": { opacity: "1", transform: "translateY(0) scale(1)" } },
        ticker: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        ticker: "ticker linear infinite",
        "fade-up": "fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.3s ease both",
        "scale-in": "scale-in 0.18s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "toast-in": "toast-in 0.28s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
