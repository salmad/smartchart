import animate from 'tailwindcss-animate'

// App chrome tokens (the slides use slides.css). The shadcn names map onto the same dark tokens.
// The public site: two looks on one set of tokens, switched by [data-look] on .site (see index.css).
// Paper: a light page around the dark slides. Ink: the brand board's warm black, cream type and gold focus.
const v = (n) => `rgb(var(--site-${n}) / <alpha-value>)`
const site = {
  paper: v('paper'), 'paper-2': v('paper-2'), card: v('card'), type: v('type'), 'type-2': v('type-2'), 'type-3': v('type-3'),
  rule: v('rule'), focus: v('focus'), night: v('night'), stage: 'rgb(var(--brand-black) / <alpha-value>)',
}

// App chrome: --app-* in index.css, flipped by html[data-chrome]. Lines use --app-rule at a low alpha so they sit on
// any surface. Brand blacks/creams still feed the dark set and the site's Ink look (brand-palette.test.ts).
const a = (n) => `rgb(var(--app-${n}) / <alpha-value>)`
const app = {
  'app-bg': a('bg'), panel: a('panel'), raise: a('raise'),
  line: 'rgb(var(--app-rule) / .08)', hair: 'rgb(var(--app-rule) / .04)', 'line-2': 'rgb(var(--app-rule) / .14)',
  ink: a('ink'), 'ink-2': a('ink-2'), 'ink-3': a('ink-3'), gold: a('gold'), ok: '#7BD88F', warn: '#F2B35B', bad: '#FF6B57',
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
        // A highlighted row steps to panel: popups sit on raise, so raise on raise would not show.
        accent: { DEFAULT: app.panel, foreground: app.ink },
        muted: { DEFAULT: app.raise, foreground: app['ink-3'] },
        destructive: { DEFAULT: app.bad, foreground: app.ink },
        border: app.line, input: app['line-2'], ring: app['ink-3'],
      },
      // The app bar's height: the bar is h-bar, and every screen sizes its body and its slides from this one number.
      // bar: the app bar's height. side: the right-hand slot (the agent, Look, Versions, Comments, Checks), one width so
      // the page never moves when one panel takes over from another.
      spacing: { bar: '56px', side: '360px' },
      // What floats over the page (menus, popovers, dialogs): lit top edge + soft shadow; --app-menu-shadow flips with chrome.
      boxShadow: { menu: 'var(--app-menu-shadow)' },
      // Named, never arbitrary: tailwindcss-animate also owns duration-* and ease-*, so duration-[1400ms] or
      // ease-[cubic-bezier(…)] is ambiguous and silently dropped, and the transition snaps at the 150ms default.
      transitionDuration: { 120: '120ms' },
      // A strong ease-out: quick to respond, long to settle. Use ease-out-strong for anything that arrives or is pressed.
      transitionTimingFunction: { 'out-strong': 'cubic-bezier(.23,1,.32,1)' },
      fontFamily: {
        sans: ['Geist', '"Geist Fallback"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"Geist Mono Fallback"', 'monospace'],
        display: ['Archivo', '"Archivo Fallback"', 'sans-serif'],
        serif: ['"Instrument Serif"', '"Instrument Serif Fallback"', 'Georgia', 'serif'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        pop: { from: { opacity: '0', transform: 'translateY(-4px)' } },
        // A new slide arriving: it comes into focus rather than popping in.
        reveal: { from: { opacity: '0', transform: 'scale(.985)', filter: 'blur(8px)' } },
        // A caption rising into place; a bar of a chart growing.
        rise: { from: { opacity: '0', transform: 'translateY(10px)', filter: 'blur(6px)' } },
        grow: { from: { transform: 'scaleY(0)' } },
        // A bar of a timeline drawing itself from its start date.
        stretch: { from: { transform: 'scaleX(0)', opacity: '0' } },
        dash: { to: { strokeDashoffset: '-36' } },
        // A turn at work: gold stars fading in and out around the slide, and a star turning in the status line.
        twinkle: { '0%, 100%': { opacity: '0', transform: 'scale(.2) rotate(0deg)' }, '50%': { opacity: '1', transform: 'scale(1) rotate(90deg)' } },
        glint: { '0%, 100%': { opacity: '.7', transform: 'scale(.8) rotate(0deg)' }, '50%': { opacity: '1', transform: 'scale(1.1) rotate(90deg)' } },
        // The tour's mark on what was just clicked: a gold ring breathing out and back.
        beacon: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '.35', transform: 'scale(1.12)' } },
        sheen: { from: { transform: 'translateX(-120%) skewX(-20deg)' }, to: { transform: 'translateX(220%) skewX(-20deg)' } },
      },
      animation: { pop: 'pop .14s ease-out', reveal: 'reveal .7s cubic-bezier(.2,.7,.2,1)', rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both', grow: 'grow .9s cubic-bezier(.2,.7,.2,1) both', stretch: 'stretch .9s cubic-bezier(.2,.7,.2,1) both', twinkle: 'twinkle 2.4s ease-in-out infinite both', glint: 'glint 1.6s ease-in-out infinite', beacon: 'beacon 1.6s ease-in-out infinite', shimmer: 'sheen 3.2s cubic-bezier(.4,0,.2,1) infinite' },
    },
  },
  plugins: [animate],
}
