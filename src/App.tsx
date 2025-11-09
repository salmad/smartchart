import { motion } from 'framer-motion'
import { Button } from '@/shared/components/ui/button'
import { MessageSquare, Settings } from 'lucide-react'
import { staggerContainer, staggerItem, fadeInUp } from '@/shared/lib/animations'
import { useKeyboardShortcut } from '@/shared/hooks/useKeyboardShortcuts'
import { SidebarPanel } from '@/shared/components/SidebarPanel'
import { AppProviders } from '@/app/providers/AppProviders'
import { ChartPanel } from '@/features/chart'
import { ChatPanel } from '@/features/chat'
import { SettingsPanel } from '@/features/settings'
import { CommandPalette } from '@/shared/components/CommandPalette'
import { useUIState } from '@/app/providers/UIStateProvider'

function AppContent() {
  const { isChatOpen, isSettingsOpen, toggleChat, toggleSettings } = useUIState()

  // Keyboard shortcut: Cmd+Shift+K or Ctrl+Shift+K to toggle chat
  useKeyboardShortcut('k', toggleChat, { shiftKey: true })

  return (
    <div className="min-h-screen gradient-mesh relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-grid-slate-100/[0.02] bg-[size:75px_75px]" />

      <div className="relative container mx-auto px-6 py-8 max-w-[1600px]">
        {/* Premium Header with animations */}
        <motion.div
          className="mb-12 text-center space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-2"
            variants={staggerItem}
          >
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Powered by AI
            </span>
          </motion.div>

          <motion.h1 className="text-6xl md:text-7xl font-bold tracking-tighter" variants={staggerItem}>
            <span className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
              SmartChart
            </span>
          </motion.h1>

          <motion.p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium" variants={staggerItem}>
            Transform data into stunning visualizations with natural language.
            <br />
            <span className="text-slate-500 text-base">Try chatting with the AI to modify your chart.</span>
          </motion.p>
        </motion.div>

        {/* Main Content - Flex Layout with Settings Left, Chart Center, Chat Right */}
        <motion.div className="relative flex gap-0" variants={staggerContainer} initial="hidden" animate="visible">
          {/* Settings Panel - Left sidebar */}
          <SidebarPanel
            isOpen={isSettingsOpen}
            onClose={toggleSettings}
            side="left"
            width="320px"
          >
            <SettingsPanel onClose={toggleSettings} />
          </SidebarPanel>

          {/* Settings Toggle Button - Floating when settings is closed */}
          {!isSettingsOpen && (
            <motion.div
              className="fixed left-4 bottom-6 lg:left-8 lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto z-40"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                onClick={toggleSettings}
                size="lg"
                className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 transition-all duration-300 hover:scale-110"
                aria-label="Open Settings"
              >
                <Settings className="w-6 h-6" />
              </Button>
            </motion.div>
          )}

          {/* Chart Panel - Takes remaining space */}
          <motion.div
            className="flex-1 min-w-0"
            variants={fadeInUp}
            style={{
              paddingLeft: isSettingsOpen ? '1.5rem' : '0',
              paddingRight: isChatOpen ? '1.5rem' : '0',
            }}
          >
            <ChartPanel onOpenSettings={toggleSettings} />
          </motion.div>

          {/* Chat Toggle Button - Floating when chat is closed */}
          {!isChatOpen && (
            <motion.div
              className="fixed right-4 bottom-6 lg:right-8 lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto z-40"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                onClick={toggleChat}
                size="lg"
                className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 transition-all duration-300 hover:scale-110"
                aria-label="Open AI Assistant"
              >
                <MessageSquare className="w-6 h-6" />
              </Button>
            </motion.div>
          )}

          {/* Chat Panel - Fixed width sidebar on desktop, overlay on mobile/tablet */}
          <SidebarPanel
            isOpen={isChatOpen}
            onClose={toggleChat}
            side="right"
            width="380px"
          >
            <ChatPanel onClose={toggleChat} />
          </SidebarPanel>
        </motion.div>

        {/* Footer badge */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>Built with precision and care</span>
          </div>
        </motion.div>
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  )
}

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  )
}

export default App
