/** @type {import('tailwindcss').Config} */
// NativeWind config. Brand tokens mirror the web (lib/theme.ts / web index.css).
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Mirrors the web: Fraunces (display), Newsreader (body), Inter (sans).
        // Names are the embedded TTFs' PostScript names (see assets/fonts).
        display: ["Fraunces-SemiBold"],
        body: ["Newsreader-Regular"],
        sans: ["Inter-Regular"],
      },
      colors: {
        background: "#F7F1E6",
        surface: "#FFFDF8",
        ink: "#25211C",
        "deep-brown": "#3A2F25",
        "soft-ink": "#6F675C",
        "faint-ink": "#A59B8D",
        "accent-sepia": "#8A6F4D",
        border: "#E6DCC9",
      },
    },
  },
  plugins: [],
};
