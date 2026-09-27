import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/engine/slides/slides.css'
import './index.css'
import { Root } from '@/app/Root'

const root = document.getElementById('root')
if (root) createRoot(root).render(<StrictMode><Root /></StrictMode>)
