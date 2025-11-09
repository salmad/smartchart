import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  callback: () => void
  description?: string
}

/**
 * Custom hook to register keyboard shortcuts
 * @param shortcuts - Array of keyboard shortcut configurations
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const shiftMatches = shortcut.shiftKey === undefined || e.shiftKey === shortcut.shiftKey
        const altMatches = shortcut.altKey === undefined || e.altKey === shortcut.altKey

        // Check if modifier key is required (either ctrl or meta for cross-platform)
        const modifierRequired = shortcut.ctrlKey || shortcut.metaKey
        const modifierPressed = modifierRequired ? (e.ctrlKey || e.metaKey) : true

        if (keyMatches && shiftMatches && altMatches && modifierPressed) {
          e.preventDefault()
          shortcut.callback()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [shortcuts])
}

/**
 * Single keyboard shortcut hook for convenience
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: {
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  }
) {
  useKeyboardShortcuts([
    {
      key,
      ...options,
      callback,
    },
  ])
}
