/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0e1410",
        bg2: "#131c17",
        panel: "#17221c",
        panel2: "#1d2a23",
        line: "#25372d",
        accent: "#ff7a29",
        accent2: "#f4b860",
        green2: "#6cc28a",
        red2: "#e87262",
        blue2: "#6aa5d6",
        muted: "#9fb1a5",
        text: "#e8f0ea",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
