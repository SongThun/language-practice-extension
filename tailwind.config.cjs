/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: "#323437",
        card: "#2c2e31",
        text: "#d1d0c5",
        primary: "#e2b714",
        muted: "#646669",
        border: "#464849",
        destructive: "#ca4754",
      },
      fontFamily: {
        mono: ['"Roboto Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
