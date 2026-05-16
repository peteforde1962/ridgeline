/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RidgeLine warm trail palette
        cream:  "#dcc9a9",
        brick:  "#b83a2d",
        forest: "#4e6851",
        bg:     "#1a221b",
        bg2:    "#232c24",
        panel:  "#2c3a2f",
        panel2: "#38483a",
        line:   "#4e6851",
        text:   "#dcc9a9",
        muted:  "#a99e7f",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
