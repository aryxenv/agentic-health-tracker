/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        surface: {
          card: '#1e293b',
          subtle: '#334155',
          dark: '#0f172a',
        },
        macro: {
          protein: '#38bdf8', // Cyan
          carbs: '#fbbf24',   // Amber
          fat: '#f87171',     // Rose
          fiber: '#34d399',   // Emerald
          active: '#fb923c',  // Orange
        }
      }
    },
  },
  plugins: [],
};
