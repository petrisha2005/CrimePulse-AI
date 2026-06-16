/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        command: {
          950: "#06111f",
          900: "#0a1728",
          850: "#0f2034",
          800: "#14283d",
          700: "#1e3a55",
          500: "#2e8bd8",
          300: "#83c5ff"
        },
        alert: {
          critical: "#ef4444",
          high: "#f97316",
          medium: "#facc15",
          low: "#22c55e"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(46, 139, 216, 0.18)"
      }
    }
  },
  plugins: []
};
