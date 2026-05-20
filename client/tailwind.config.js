/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      boxShadow: {
        glow: "0 24px 90px rgba(34, 211, 238, 0.16)",
        soft: "0 20px 60px rgba(0, 0, 0, 0.32)"
      },
      colors: {
        ink: "#0b1020",
        panel: "rgba(15, 23, 42, 0.72)"
      }
    }
  },
  plugins: []
};
