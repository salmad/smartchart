import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import '@/engine/slides/slides.css'
import './index.css'
import { Root } from '@/app/Root'
import { takeEmailEntry } from '@/app/email-entry'

// index.html loads the stylesheet without blocking the first paint (vite/async-css.ts); the app draws once it has applied.
declare global { interface Window { __css?: Promise<void> } }

// Visits and referrers in Vercel Web Analytics (enabled per project in the dashboard); nothing is sent in dev.
// An email's entry path is counted as its own view (see email-entry.ts); the page it moves on to is counted as usual.
const fromEmail = takeEmailEntry()
void import('@vercel/analytics').then(({ inject, pageview }) => {
  inject({ mode: import.meta.env.DEV ? 'development' : 'production' })
  if (fromEmail && !fromEmail.video) pageview({ route: '/em/[email]', path: fromEmail.path })
  // A video link: give the view a moment to send, then go to the video.
  if (fromEmail?.video) setTimeout(() => location.replace(`https://youtube.com/shorts/${fromEmail.video}`), 600)
})

const root = document.getElementById('root')
if (root && !fromEmail?.video) void (window.__css ?? Promise.resolve()).then(() => createRoot(root).render(<StrictMode><Root /></StrictMode>))
