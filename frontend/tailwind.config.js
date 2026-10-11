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
        // Warm campus editorial palette: evergreen, clay, and paper neutrals.
        brand: {
          50:  '#fbf1ed',
          100: '#f5dfd6',
          200: '#ebc0b0',
          300: '#dc987f',
          400: '#cd765a',
          500: '#bd583d',
          600: '#a74932',
          700: '#893e2e',
          800: '#71372c',
          900: '#5d3028',
          950: '#321813',
        },
        surface: {
          DEFAULT: '#f7f5ef',
          card:    '#fffefa',
          raised:  '#f1efe8',
          border:  '#dfded5',
        },
        slate: {
          50: '#f7f5ef',
          100: '#efeee7',
          200: '#dfded5',
          300: '#c8cbc2',
          400: '#9ba39a',
          500: '#7b857d',
          600: '#65716a',
          700: '#48554e',
          800: '#303b35',
          900: '#202924',
          950: '#141a17',
        },
        blue: {
          50: '#edf4ef',
          100: '#dceae0',
          200: '#bed6c7',
          300: '#92bba3',
          400: '#639782',
          500: '#397b6c',
          600: '#1f6762',
          700: '#1f514c',
          800: '#1a423f',
          900: '#173733',
          950: '#0d211f',
        },
        indigo: {
          50: '#f1f2ee',
          100: '#e4e6df',
          200: '#cdd2c7',
          300: '#adb7a8',
          400: '#869687',
          500: '#687d70',
          600: '#52685d',
          700: '#435449',
          800: '#37443b',
          900: '#2b352f',
          950: '#1a211d',
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
        'gradient-brand': 'linear-gradient(135deg, #1f514c 0%, #397b6c 100%)',
        'gradient-dark': 'linear-gradient(180deg, #202924 0%, #303b35 100%)',
      },
    },
  },
  plugins: [],
};
