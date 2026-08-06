/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#071A1E",
          900: "#0D2620",
          800: "#123E3B",
          700: "#1A5450",
          600: "#226B63",
          500: "#2C8377",
          400: "#4FA495",
          300: "#83C4B4",
          200: "#BEE0D3",
          100: "#E4F3EC",
          50: "#F2F8F5",
        },
        gold: {
          700: "#8C6B22",
          600: "#A8822E",
          500: "#C9A24B",
          400: "#DDBB6E",
          300: "#EAD39A",
          200: "#F3E4BE",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(7, 26, 30, 0.06), 0 1px 3px 0 rgba(7, 26, 30, 0.08)",
      },
    },
  },
  plugins: [],
};
