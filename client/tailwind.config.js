/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f4f2fe",
          100: "#eae6fd",
          200: "#d6cbfb",
          300: "#b9a6f6",
          400: "#9b7df0",
          500: "#7c5ce7",
          600: "#6c4fe0",
          700: "#5a3fc4",
          800: "#4a34a0",
          900: "#3c2c80",
        },
        ink: {
          900: "#1c1b2e",
          800: "#26243d",
          700: "#322f4d",
        },
      },
      boxShadow: {
        card: "0 24px 60px -20px rgba(76, 52, 160, 0.35)",
        soft: "0 8px 24px -12px rgba(28, 27, 46, 0.18)",
      },
    },
  },
  plugins: [],
};
