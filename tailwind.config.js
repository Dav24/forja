/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0C0A09",
        surface: "#1C1917",
        "surface-elevated": "#292524",
        primary: "#F97316",
        "primary-bright": "#FBBF24",
        "primary-dim": "#7C2D12",
        accent: "#FBBF24",
        text: "#FAFAF9",
        "text-muted": "#A8A29E",
        border: "#292524",
        destructive: "#EF4444",
        warning: "#F59E0B",
        success: "#22C55E",
      },
    },
  },
  plugins: [],
};
