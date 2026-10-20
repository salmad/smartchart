import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import '@/engine/slides/slides.css'
import './index.css'
import { Root } from '@/app/Root'

// index.html loads the stylesheet without blocking the first paint (vite/async-css.ts); the app draws once it has applied.
declare global { interface Window { __css?: Promise<void> } }

const root = document.getElementById('root')
if (root) void (window.__css ?? Promise.resolve()).then(() => createRoot(root).render(<StrictMode><Root /></StrictMode>))
