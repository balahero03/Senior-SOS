/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
      },
      colors: {
        // SeniorSOS: campus ink and a calm, trustworthy ocean blue.
        brand: {
          50:  '#edf6f8',
          100: '#d9ebef',
          200: '#b5d7df',
          300: '#88bdca',
          400: '#579caf',
          500: '#347d92',
          600: '#28677b',
          700: '#225363',
          800: '#1e4350',
          900: '#1a3742',
          950: '#10262e',
        },
        surface: {
          DEFAULT: '#10232b',
          card:    '#172d36',
          raised:  '#203943',
          border:  '#304a53',
        },
        slate: {
          50: '#f5f7f5',
          100: '#edf1ee',
          200: '#dce4df',
          300: '#c4d0ca',
          400: '#8b9a93',
          500: '#687770',
          600: '#4d5b54',
          700: '#37453f',
          800: '#26342e',
          900: '#17251f',
          950: '#0e1713',
        },
        blue: {
          50: '#edf6f8',
          100: '#d9ebef',
          200: '#b5d7df',
          300: '#88bdca',
          400: '#579caf',
          500: '#347d92',
          600: '#28677b',
          700: '#225363',
          800: '#1e4350',
          900: '#1a3742',
          950: '#10262e',
        },
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-brand':
          'linear-gradient(135deg, #225363 0%, #347d92 100%)',
        'gradient-dark':
          'linear-gradient(180deg, #10232b 0%, #172d36 100%)',
      },
    },
  },
  plugins: [],
};
