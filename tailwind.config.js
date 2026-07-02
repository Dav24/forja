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
        background: "#0A0A0F",
        surface: "#13131C",
        "surface-elevated": "#1E1E2E",
        primary: "#22C55E",
        "primary-dim": "#166534",
        accent: "#818CF8",
        text: "#F1F5F9",
        "text-muted": "#64748B",
        border: "#1E293B",
        destructive: "#EF4444",
        warning: "#F59E0B",
        success: "#22C55E",
      },
    },
  },
  plugins: [],
};
