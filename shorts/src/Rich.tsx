import type { CSSProperties } from 'react'
import { C, F } from './theme'

const em: CSSProperties = { fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, fontStretch: '100%', color: C.gold, letterSpacing: 0 }

/** Text with *emphasis* set in gold serif italic (a deeper gold on paper, where the ink gold washes out). */
export const Rich = ({ text, emScale = 1.12, onPaper = false }: { text: string; emScale?: number; onPaper?: boolean }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
      part.startsWith('*') && part.endsWith('*')
        ? <span key={i} style={{ ...em, fontSize: `${emScale}em`, ...(onPaper && { color: '#A87A12' }) }}>{part.slice(1, -1)}</span>
        : <span key={i}>{part}</span>)}
  </>
)

export const plain = (text: string) => text.replace(/\*/g, '')
