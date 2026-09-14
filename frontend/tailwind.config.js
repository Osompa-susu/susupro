/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16211f', paper: '#f6f4ef', panel: '#ffffff', line: '#dcd6c8',
        teal: { DEFAULT: '#0f3d3e', dark: '#0a2b2c' },
        gold: { DEFAULT: '#b8863b', soft: '#f1e4c9' },
        good: '#2f6d4f', bad: '#a5372f', muted: '#6b6459',
      },
      borderRadius: { DEFAULT: '3px' },
      fontFamily: { sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
