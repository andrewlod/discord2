/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        discord: {
          bg: '#36393f',
          'bg-secondary': '#2f3136',
          'bg-tertiary': '#202225',
          text: '#dcddde',
          'text-muted': '#72767d',
          'text-link': '#00b0f4',
          border: '#202225',
          accent: '#5865f2',
          'accent-hover': '#4752c4',
          green: '#3ba55c',
          red: '#ed4245',
          yellow: '#faa61a',
          blurple: '#5865f2',
          purple: '#9b59b6',
        },
        accent: '#5865f2',
        'accent-hover': '#4752c4',
        primary: '#36393f',
        secondary: '#2f3136',
        tertiary: '#202225',
        'bg-primary': '#36393f',
        'bg-secondary': '#2f3136',
        'bg-tertiary': '#202225',
        'text-primary': '#dcddde',
        'text-secondary': '#72767d',
        'text-link': '#00b0f4',
        'text-muted': '#72767d',
        border: '#202225',
        red: '#ed4245',
        green: '#3ba55c',
        yellow: '#faa61a',
        blurple: '#5865f2',
        purple: '#9b59b6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}