/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#050a14',
          900: '#08111f',
          850: '#0b1628',
          800: '#0f1d33',
          700: '#162a47',
          600: '#21385c',
          500: '#3a5378',
          400: '#6b7f9e',
          300: '#9aabc4',
          200: '#c5d1e2',
          100: '#e6ecf5',
        },
        cyan: { DEFAULT: '#22d3ee', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
        signal: { DEFAULT: '#2f7bff', 500: '#2f7bff', 600: '#1f63e0' },
        magenta: { DEFAULT: '#e0377f', 500: '#e0377f' },
        sev: { critical: '#ff4d6d', high: '#ff8a3d', medium: '#f5c84c', low: '#4cc9f0' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,.25), 0 8px 40px -12px rgba(34,211,238,.35)',
      },
      keyframes: {
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
      },
      animation: {
        scan: 'scan 3s linear infinite',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
