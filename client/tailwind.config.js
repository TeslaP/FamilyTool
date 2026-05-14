import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        editorial: ["Newsreader", "Georgia", "serif"],
      },
      fontSize: {
        hero: ["5rem", { lineHeight: "0.95", letterSpacing: "-0.04em", fontWeight: "300" }],
      },
      borderRadius: {
        "2xl": "20px",
        xl: "14px",
        lg: "10px",
      },
      boxShadow: {
        card: "0 4px 20px rgba(28,25,23,0.06)",
        "card-hover": "0 6px 24px rgba(28,25,23,0.08)",
      },
    },
  },
  plugins: [],
};
