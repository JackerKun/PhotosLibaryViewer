/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'mac-bg': '#1c1c1e',
        'mac-sidebar': '#2c2c2e',
        'mac-card': '#3a3a3c',
        'mac-border': '#3a3a3c',
        'mac-text': '#ffffff',
        'mac-text-secondary': '#8e8e93',
        'mac-accent': '#0a84ff',
        'mac-accent-hover': '#0071e3',
        'mac-danger': '#ff453a',
        'mac-warning': '#ff9f0a',
        'mac-success': '#32d74b',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
