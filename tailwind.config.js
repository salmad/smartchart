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
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        pop: { from: { opacity: '0', transform: 'translateY(-4px)' } },
        // A new slide arriving: it comes into focus rather than popping in.
        reveal: { from: { opacity: '0', transform: 'scale(.985)', filter: 'blur(8px)' } },
        // The landing film: a caption rising into place, a chapter bar filling, a bar of a chart growing.
        rise: { from: { opacity: '0', transform: 'translateY(10px)', filter: 'blur(6px)' } },
        'film-fill': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        grow: { from: { transform: 'scaleY(0)' } },
        dash: { to: { strokeDashoffset: '-36' } },
        // The narrator handing over: the old line drifts up and blurs out as the new one rises in.
        leave: { to: { opacity: '0', transform: 'translateY(-12px)', filter: 'blur(6px)' } },
        // Occam reading the doc: a gold line sweeping down the page.
        scan: { '0%': { top: '0%', opacity: '0' }, '10%': { opacity: '1' }, '90%': { opacity: '1' }, '100%': { top: '100%', opacity: '0' } },
        // The slide arriving: sparks around it, and light passing across it once.
        sparkle: { '0%': { opacity: '0', transform: 'scale(0) rotate(0deg)' }, '40%': { opacity: '1', transform: 'scale(1) rotate(90deg)' }, '100%': { opacity: '0', transform: 'scale(.2) rotate(180deg) translateY(-1.5cqw)' } },
        sheen: { from: { transform: 'translateX(-120%) skewX(-20deg)' }, to: { transform: 'translateX(220%) skewX(-20deg)' } },
        // A sent message leaving the composer, up into the chat.
        send: { '0%': { opacity: '1', transform: 'none' }, '100%': { opacity: '0', transform: 'translateY(-5cqw) scale(.94)' } },
      },
      animation: { pop: 'pop .14s ease-out', reveal: 'reveal .7s cubic-bezier(.2,.7,.2,1)', rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both', grow: 'grow .9s cubic-bezier(.2,.7,.2,1) both', send: 'send .9s cubic-bezier(.4,0,.2,1) .15s both', leave: 'leave .6s cubic-bezier(.4,0,.2,1) both', scan: 'scan 3.4s cubic-bezier(.4,0,.2,1) both', sparkle: 'sparkle 1.4s cubic-bezier(.2,.8,.2,1) both', sheen: 'sheen 1.4s cubic-bezier(.4,0,.2,1) .2s both' },
    },
  },
  plugins: [animate],
}
