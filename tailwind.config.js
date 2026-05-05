/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg:           '#0a0a0a',
        card:         '#141414',
        card2:        '#1e1e1e',
        accent:       '#22c55e',
        'accent-dim': '#16a34a',
        muted:        '#6b7280',
      },
      borderRadius: { '4xl': '2rem' },
      animation: {
        'fade-in':  'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-g':  'pulseG 2s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },                                    to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' },     to: { opacity: 1, transform: 'translateY(0)' } },
        pulseG:  { '0%,100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(34,197,94,0)' } },
      },
    },
  },
  plugins: [],
}
