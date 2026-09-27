import animate from 'tailwindcss-animate'

// App chrome tokens (the slides use slides.css). The shadcn names map onto the same dark tokens.
// The public site: a light page (day) around the dark Ink slides (night).
const site = { paper: '#F5F5F3', 'paper-2': '#ECECE8', type: '#121211', 'type-2': '#5C5B57', 'type-3': '#8A8984', rule: '#E1E0DB', stage: '#0B0A09' }

const app = {
  'app-bg': '#0A0A0B', panel: '#111113', raise: '#18181B', line: 'rgba(255,255,255,.08)', 'line-2': 'rgba(255,255,255,.14)',
  ink: '#EDEDEF', 'ink-2': '#A1A1AA', 'ink-3': '#71717A', ok: '#7BD88F', warn: '#F2B35B', bad: '#FF6B57',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/app/**/*.{ts,tsx}', './src/main.tsx'],
  theme: {
    extend: {
      colors: {
        ...app, ...site,
        background: app['app-bg'], foreground: app.ink,
        popover: { DEFAULT: app.raise, foreground: app.ink },
        primary: { DEFAULT: app.ink, foreground: app['app-bg'] },
        accent: { DEFAULT: app.raise, foreground: app.ink },
        muted: { DEFAULT: app.raise, foreground: app['ink-3'] },
        destructive: { DEFAULT: app.bad, foreground: app.ink },
        border: app.line, input: app['line-2'], ring: app['ink-3'],
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
        display: ['Archivo', 'sans-serif'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        pop: { from: { opacity: '0', transform: 'translateY(-4px)' } },
        // A new slide arriving: it comes into focus rather than popping in.
        reveal: { from: { opacity: '0', transform: 'scale(.985)', filter: 'blur(8px)' } },
      },
      animation: { pop: 'pop .14s ease-out', reveal: 'reveal .7s cubic-bezier(.2,.7,.2,1)' },
    },
  },
  plugins: [animate],
}
