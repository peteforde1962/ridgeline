/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RidgeLine dark teal + peach palette
        teal:   "#134857",
        char:   "#262a2b",
        peach:  "#f8b6a6",
        bg:     "#134857",
        bg2:    "#0e3a47",
        panel:  "#262a2b",
        panel2: "#2f3334",
        line:   "#2d5c6c",
        text:   "#f4eee4",
        muted:  "#a7bcc4",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
