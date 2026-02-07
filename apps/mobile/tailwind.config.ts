import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        "primary-hover": "#1d4ed8",
        secondary: "#64748b",
        accent: "#8b5cf6",
      },
    },
  },
  plugins: [],
} satisfies Config;
