/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1d4ed8',
        accent: '#0f766e',
        danger: '#dc2626',
        warning: '#d97706',
        success: '#15803d',
      },
    },
  },
  plugins: [],
};
