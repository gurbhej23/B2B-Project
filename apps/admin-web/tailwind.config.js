/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1E8',
          100: '#FED7AA',
          200: '#FDBA74',
          300: '#FB923C',
          400: '#F97316',
          500: '#F47732', // Primary orange
          600: '#E95B2A', // Deep orange
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          primary: '#F47732',
          deep: '#E95B2A',
          light: '#FFF1E8',
          border: '#F0E0D5',
          bg: '#FFFFFF',
          card: '#FFFFFF',
          highlight: '#FFF8F3',
          text: '#292929',
          muted: '#737373',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
