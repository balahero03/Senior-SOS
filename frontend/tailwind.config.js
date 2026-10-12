/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // LinkedIn-inspired professional palette with unique SeniorSOS Royal identity
        brand: {
          50: '#eef5fc',
          100: '#d9eaf9',
          200: '#b8daf4',
          300: '#84c1ee',
          400: '#48a1e4',
          500: '#0a66c2', // Primary LinkedIn / SeniorSOS Royal
          600: '#004182',
          700: '#003366',
          800: '#00264d',
          900: '#001a35',
          950: '#000f21',
        },
        surface: {
          canvas: '#f4f2ee', // Signature LinkedIn calm neutral background
          card: '#ffffff',
          subtle: '#f8fafc',
          hover: '#f1f5f9',
          border: '#e2e8f0',
        },
      },
      boxShadow: {
        'linkedin': '0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'linkedin-hover': '0 0 0 1px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)',
        'dropdown': '0 4px 20px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
