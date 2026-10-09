const animate = require("tailwindcss-animate")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{ts,tsx,vue}',
    './src/components/**/*.{ts,tsx,vue}',
    './src/app/**/*.{ts,tsx,vue}',
    './src/**/*.{ts,tsx,vue}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Microsoft Sticky Note Custom Color Themes
        sticky: {
          yellow: {
            bg: "#fff7d1",
            header: "#faea8d",
            border: "#ecd76b",
            text: "#3c3b30",
          },
          green: {
            bg: "#e4f9e0",
            header: "#c4eec0",
            border: "#a4db9f",
            text: "#2d422a",
          },
          pink: {
            bg: "#ffe4ec",
            header: "#f7bfd2",
            border: "#e79bb6",
            text: "#462933",
          },
          purple: {
            bg: "#f2e7fe",
            header: "#dbc5fb",
            border: "#c3a2f3",
            text: "#392a4a",
          },
          blue: {
            bg: "#e2f2ff",
            header: "#b9ddff",
            border: "#90c5f7",
            text: "#22384c",
          },
          charcoal: {
            bg: "#2b2b2b",
            header: "#212121",
            border: "#3a3a3a",
            text: "#f0f0f0",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
}
