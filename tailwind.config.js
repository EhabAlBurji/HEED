/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 2x Grid (IBM Carbon-style): the <Column> primitive builds span classes
  // dynamically, so safelist the 16-column spans + their md/lg variants.
  safelist: [
    "grid-cols-16",
    { pattern: /^col-span-(1[0-6]|[1-9])$/, variants: ["md", "lg"] },
    { pattern: /^col-start-(1[0-6]|[1-9])$/, variants: ["md", "lg"] },
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // Carbon 2x spacing scale (8px base + sub-steps). Use as p-c5, gap-c7…
      spacing: {
        c1: "2px",
        c2: "4px",
        c3: "8px",
        c4: "12px",
        c5: "16px",
        c6: "24px",
        c7: "32px",
        c8: "40px",
        c9: "48px",
        c10: "64px",
        c11: "80px",
        c12: "96px",
        c13: "160px",
      },
      maxWidth: {
        carbon: "1584px",
      },
      gridTemplateColumns: {
        16: "repeat(16, minmax(0, 1fr))",
      },
      gridColumn: {
        "span-13": "span 13 / span 13",
        "span-14": "span 14 / span 14",
        "span-15": "span 15 / span 15",
        "span-16": "span 16 / span 16",
      },
      fontFamily: {
        sans: ["Graphik Arabic", "Forma DJR Deck", "system-ui", "sans-serif"],
        display: ["Graphik Arabic", "Forma DJR Deck", "sans-serif"],
        micro: ["Graphik Arabic", "Forma DJR Micro", "Forma DJR Deck", "sans-serif"],
      },
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
        // Brand palette — ryswift edition
        brand: {
          violet:        "#6735E1",  // vivid primary
          "violet-light": "#8B6BEC",
          "violet-soft":  "#C4B5FD",
          "violet-bg":    "#ECE4FD",
          yellow:        "#FFCF27",   // warm accent
          "yellow-soft": "#FFE383",
          // Pastel feature card backgrounds (kept for accents)
          "pastel-purple": "#ECE4FD",
          "pastel-green":  "#DCF5E1",
          "pastel-blue":   "#DEE7FA",
          "pastel-red":    "#FAE0DC",
          "pastel-yellow": "#FFF4C0",
          ink:            "#172935",
          "ink-soft":     "#3A4754",
          grey:           "#858585",
        },
      },
      backgroundImage: {
        "gradient-brand":  "linear-gradient(135deg, #6735E1 0%, #8B6BEC 50%, #C4B5FD 100%)",
        "gradient-cta":    "linear-gradient(135deg, #6735E1 0%, #8B6BEC 100%)",
        "gradient-card":   "linear-gradient(145deg, rgba(103,53,225,0.06) 0%, transparent 60%)",
        "gradient-glow":   "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(103,53,225,0.18) 0%, transparent 70%)",
        "gradient-hero":   "linear-gradient(135deg, #ECE4FD 0%, #FFFFFF 50%, #DEE7FA 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 4px 24px rgba(103,53,225,0.25)" },
          "50%":       { boxShadow: "0 8px 48px rgba(103,53,225,0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        glow: "glow 3s ease-in-out infinite",
      },
      opacity: {
        8: "0.08",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
