/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mantle: {
          primary: '#65B3AE',
          dark: '#0D1117',
          darker: '#090C10',
          card: '#161B22',
          border: '#30363D',
          muted: '#8B949E',
          accent: '#FFD700',
        },
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': {
            boxShadow:
              '0 0 5px rgba(101, 179, 174, 0.2), 0 0 10px rgba(101, 179, 174, 0.1)',
          },
          '100%': {
            boxShadow:
              '0 0 20px rgba(101, 179, 174, 0.4), 0 0 40px rgba(101, 179, 174, 0.2)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
