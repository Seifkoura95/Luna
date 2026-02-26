/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#272727",
        input: "#272727",
        ring: "#E31837",
        background: "#050505",
        foreground: "#FFFFFF",
        primary: {
          DEFAULT: "#E31837",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#FFD700",
          foreground: "#000000",
        },
        muted: {
          DEFAULT: "#272727",
          foreground: "#A3A3A3",
        },
        accent: {
          DEFAULT: "#1A1A1A",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#0F0F0F",
          foreground: "#FFFFFF",
        },
        surface: "#0F0F0F",
        "surface-highlight": "#1A1A1A",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        heading: ["Chivo", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(227, 24, 55, 0.15)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.15)',
        'glow-red-strong': '0 0 30px rgba(227, 24, 55, 0.3)',
      }
    },
  },
  plugins: [],
}
