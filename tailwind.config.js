/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6D5BF6',
          hover: '#5B4AD4',
          active: '#4A3AB2',
        },
        dark: {
          bg: '#0F1117',
          surface: '#1A1D29',
          border: '#2A2D3A',
          text: '#E8E9ED',
          'text-secondary': '#9CA3AF',
        },
        light: {
          bg: '#FFFFFF',
          surface: '#F9FAFB',
          border: '#E5E7EB',
          text: '#0F172A',
          'text-secondary': '#64748B',
        },
      },
      fontSize: {
        base: '14px',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}
