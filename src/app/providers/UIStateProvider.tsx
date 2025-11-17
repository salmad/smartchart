import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'

interface UIStateContextValue {
  isChatOpen: boolean
  isSettingsOpen: boolean
  toggleChat: () => void
  toggleSettings: () => void
  openChat: () => void
  closeChat: () => void
  openSettings: () => void
  closeSettings: () => void
}

const UIStateContext = createContext<UIStateContextValue | null>(null)

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      const newValue = !prev
      // Close settings when opening chat
      if (newValue) {
        setIsSettingsOpen(false)
      }
      return newValue
    })
  }, [])

  const toggleSettings = useCallback(() => {
    setIsSettingsOpen(prev => {
      const newValue = !prev
      // Close chat when opening settings
      if (newValue) {
        setIsChatOpen(false)
      }
      return newValue
    })
  }, [])

  const openChat = useCallback(() => {
    setIsChatOpen(true)
    setIsSettingsOpen(false)
  }, [])

  const closeChat = useCallback(() => {
    setIsChatOpen(false)
  }, [])

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
    setIsChatOpen(false)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      isChatOpen,
      isSettingsOpen,
      toggleChat,
      toggleSettings,
      openChat,
      closeChat,
      openSettings,
      closeSettings,
    }),
    [
      isChatOpen,
      isSettingsOpen,
      toggleChat,
      toggleSettings,
      openChat,
      closeChat,
      openSettings,
      closeSettings,
    ]
  )

  return (
    <UIStateContext.Provider value={value}>
      {children}
    </UIStateContext.Provider>
  )
}

export function useUIState() {
  const context = useContext(UIStateContext)
  if (!context) {
    throw new Error('useUIState must be used within UIStateProvider')
  }
  return context
}
