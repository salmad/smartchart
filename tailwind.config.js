import animate from 'tailwindcss-animate'

// App chrome tokens (the slides use slides.css). The shadcn names map onto the same dark tokens.
// The public site: two looks on one set of tokens, switched by [data-look] on .site (see index.css).
// Paper: a light page around the dark slides. Ink: the brand board's warm black, cream type and gold focus.
const v = (n) => `rgb(var(--site-${n}) / <alpha-value>)`
const site = {
  paper: v('paper'), 'paper-2': v('paper-2'), card: v('card'), type: v('type'), 'type-2': v('type-2'), 'type-3': v('type-3'),
  rule: v('rule'), focus: v('focus'), night: v('night'), stage: '#0B0A09',
}

const app = {
  'app-bg': '#0A0A0B', panel: '#111113', raise: '#18181B', line: 'rgba(255,255,255,.08)', 'line-2': 'rgba(255,255,255,.14)',
  ink: '#EDEDEF', 'ink-2': '#A1A1AA', 'ink-3': '#71717A', ok: '#7BD88F', gold: '#E8B94A', warn: '#F2B35B', bad: '#FF6B57',
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
      // Named, never arbitrary: tailwindcss-animate also owns duration-* and ease-*, so duration-[1400ms] or
      // ease-[cubic-bezier(…)] is ambiguous and silently dropped, and the transition snaps at the 150ms default.
      transitionDuration: { 120: '120ms' },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
        display: ['Archivo', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        pop: { from: { opacity: '0', transform: 'translateY(-4px)' } },
        // A new slide arriving: it comes into focus rather than popping in.
        reveal: { from: { opacity: '0', transform: 'scale(.985)', filter: 'blur(8px)' } },
        // A caption rising into place; a bar of a chart growing.
        rise: { from: { opacity: '0', transform: 'translateY(10px)', filter: 'blur(6px)' } },
        grow: { from: { transform: 'scaleY(0)' } },
        dash: { to: { strokeDashoffset: '-36' } },
        // A turn at work: gold stars fading in and out around the slide, and a star turning in the status line.
        twinkle: { '0%, 100%': { opacity: '0', transform: 'scale(.2) rotate(0deg)' }, '50%': { opacity: '1', transform: 'scale(1) rotate(90deg)' } },
        glint: { '0%, 100%': { opacity: '.7', transform: 'scale(.8) rotate(0deg)' }, '50%': { opacity: '1', transform: 'scale(1.1) rotate(90deg)' } },
        sheen: { from: { transform: 'translateX(-120%) skewX(-20deg)' }, to: { transform: 'translateX(220%) skewX(-20deg)' } },
      },
      animation: { pop: 'pop .14s ease-out', reveal: 'reveal .7s cubic-bezier(.2,.7,.2,1)', rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both', grow: 'grow .9s cubic-bezier(.2,.7,.2,1) both', twinkle: 'twinkle 2.4s ease-in-out infinite both', glint: 'glint 1.6s ease-in-out infinite', shimmer: 'sheen 3.2s cubic-bezier(.4,0,.2,1) infinite' },
    },
  },
  plugins: [animate],
}
