/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#3b82f6', // blue-500
          600: '#2563eb', // blue-600
          700: '#1d4ed8', // blue-700
          800: '#1e40af', // blue-800
          900: '#1e3a8a', // blue-900
        },
      },
    },
  },
  plugins: [],
}
