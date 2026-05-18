/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RidgeLine warm-minimal palette
        gold:   "#f8df70",
        taupe:  "#524b48",
        gray2:  "#a2a1a1",
        bg:     "#1a1816",
        bg2:    "#221f1c",
        panel:  "#2c2825",
        panel2: "#3a3531",
        line:   "#524b48",
        text:   "#e6e5e3",
        muted:  "#a2a1a1",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
