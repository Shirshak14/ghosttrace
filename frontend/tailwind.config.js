/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"IBM Plex Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        // Monochrome palette. The legacy ink/cyan/signal names are kept so existing classes
        // resolve to the black, white and grey look.
        ink: {
          950: '#000000',
          900: '#121212',
          850: '#161616',
          800: '#1e1e1e',
          700: '#2a2a2a',
          600: '#3a3a3a',
          500: '#636366',
          400: '#8e8e93',
          300: '#b5b5b8',
          200: '#d4d4d4',
          100: '#f2f2f2',
        },
        cyan: { DEFAULT: '#ffffff', 400: '#ffffff', 500: '#e6e6e6', 600: '#d4d4d4' },
        signal: { DEFAULT: '#bdbdbd', 500: '#bdbdbd', 600: '#8e8e93' },
        magenta: { DEFAULT: '#ff5a52', 500: '#ff5a52' },
        sev: { critical: '#ff5a52', high: '#ffa726', medium: '#f5c84c', low: '#5cc8ff' },
        ios: { green: '#3ddc84', red: '#ff5a52', orange: '#ffa726', teal: '#5cc8ff', indigo: '#bdbdbd' },
        sep: 'rgba(255,255,255,0.14)',
      },
      boxShadow: { glow: '0 0 0 1px rgba(255,255,255,.35), 0 0 12px -4px rgba(255,255,255,.2)' },
      borderRadius: { row: '18px', group: '30px', sheet: '40px' },
      transitionTimingFunction: { ios: 'cubic-bezier(0.32, 0.72, 0, 1)' },
      keyframes: {
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        shimmer: { '0%': { backgroundPosition: '100% 0' }, '100%': { backgroundPosition: '-100% 0' } },
        drift: { '0%,100%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(4%,6%)' } },
      },
      animation: {
        scan: 'scan 8s linear infinite',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        drift: 'drift 24s ease-in-out infinite',
        'drift-slow': 'drift 36s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
