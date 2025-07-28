/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./public/**/*.{html,js}", 
      "./src/**/*.{html,js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        colors: {
          matrix: '#00FF41',
          pongDark: '#121212',
          pongDark2: '#0a0a0a',
          pongMid: '#1a1a1a',
          pongLight: '#2a2a2a',
          pongGray: '#9CA3AF',
          white: '#E5E7EB',
        },
        fontFamily: {
          arcade: ['"Press Start 2P"', 'monospace'],
        },
      },
    },
    fontFamily: {
      arcade: ['"Press Start 2P"', 'monospace'],
    },    
    plugins: [],
  };
  