/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RidgeLine light palette
        cream:  "#f6f4e7",
        teal:   "#0f95b0",
        orange: "#f26838",
        bg:     "#f6f4e7",
        bg2:    "#fbfaf2",
        panel:  "#ffffff",
        panel2: "#faf8eb",
        line:   "#e2dcc4",
        text:   "#1d2a30",
        muted:  "#6c7a82",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
