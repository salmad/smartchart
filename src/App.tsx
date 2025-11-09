import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChartPanel } from './components/ChartPanel'
import { ChatPanel } from './components/ChatPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ToasterProvider } from './components/ToasterProvider'
import { CommandPalette } from './components/CommandPalette'
import { Button } from './components/ui/button'
import { MessageSquare, Settings } from 'lucide-react'
import type { ChartConfiguration } from '@/types/chart'
import { fadeInUp, staggerContainer, staggerItem } from './utils/animations'

// Initial chart configuration
const initialConfig: ChartConfiguration = {
  data: {
    dataPoints: [
      { quarter: 'Q1', 'Product A': 240, 'Product B': 139, 'Product C': 120, 'Product D': 180 },
      { quarter: 'Q2', 'Product A': 300, 'Product B': 200, 'Product C': 150, 'Product D': 220 },
      { quarter: 'Q3', 'Product A': 200, 'Product B': 278, 'Product C': 190, 'Product D': 250 },
      { quarter: 'Q4', 'Product A': 278, 'Product B': 189, 'Product C': 240, 'Product D': 300 },
    ],
    xAxisKey: 'quarter',
    seriesNames: ['Product A', 'Product B', 'Product C', 'Product D'],
  },
  styling: {
    chartType: 'bar',
    seriesTypes: {
      'Product A': 'bar',
      'Product B': 'bar',
      'Product C': 'bar',
      'Product D': 'bar',
    },
    seriesColors: [
      { gradient: 'colorA', solid: 'hsl(262, 80%, 60%)' },  // Vibrant Purple
      { gradient: 'colorB', solid: 'hsl(199, 89%, 48%)' },  // Ocean Blue
      { gradient: 'colorC', solid: 'hsl(142, 71%, 45%)' },  // Emerald Green
      { gradient: 'colorD', solid: 'hsl(280, 65%, 60%)' },  // Rich Violet
    ],
    hiddenSeries: [],
    showDataLabels: false,
    title: 'Quarterly Performance',
    subtitle: 'Sales by product across Q1-Q4',
    selectedPalette: 'founder',
  },
}

function App() {
  const [chartConfig, setChartConfig] = useState<ChartConfiguration>(initialConfig)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleChartTypeChange = (type: 'bar' | 'line' | 'combined') => {
    setChartConfig({
      ...chartConfig,
      styling: { ...chartConfig.styling, chartType: type }
    })
  }

  const handleToggleDataLabels = () => {
    setChartConfig({
      ...chartConfig,
      styling: { ...chartConfig.styling, showDataLabels: !chartConfig.styling.showDataLabels }
    })
  }

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen)
    // Close settings when opening chat
    if (!isChatOpen) {
      setIsSettingsOpen(false)
    }
  }

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen)
    // Close chat when opening settings
    if (!isSettingsOpen) {
      setIsChatOpen(false)
    }
  }

  // Keyboard shortcut: Cmd+Shift+K or Ctrl+Shift+K to toggle chat
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault()
        toggleChat()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <>
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

            <motion.h1
              className="text-6xl md:text-7xl font-bold tracking-tighter"
              variants={staggerItem}
            >
              <span className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
                SmartChart
              </span>
            </motion.h1>

            <motion.p
              className="text-lg text-slate-600 max-w-2xl mx-auto font-medium"
              variants={staggerItem}
            >
              Transform data into stunning visualizations with natural language.
              <br />
              <span className="text-slate-500 text-base">Try chatting with the AI to modify your chart.</span>
            </motion.p>


          </motion.div>

          {/* Main Content - Flex Layout with Settings Left, Chart Center, Chat Right */}
          <motion.div
            className="relative flex gap-0"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Settings Panel - Left sidebar */}
            <AnimatePresence mode="wait">
              {isSettingsOpen && (
                <>
                  {/* Backdrop for mobile/tablet */}
                  <motion.div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={toggleSettings}
                  />

                  {/* Settings panel */}
                  <motion.div
                    className="w-[320px] max-w-[90vw] flex-shrink-0 lg:relative fixed left-0 top-0 bottom-0 z-50 lg:z-auto"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <SettingsPanel
                      config={chartConfig}
                      onConfigChange={setChartConfig}
                      onClose={toggleSettings}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

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
                paddingRight: isChatOpen ? '1.5rem' : '0'
              }}
            >
              <ChartPanel
                config={chartConfig}
                onConfigChange={setChartConfig}
                onOpenSettings={toggleSettings}
              />
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
            <AnimatePresence mode="wait">
              {isChatOpen && (
                <>
                  {/* Backdrop for mobile/tablet */}
                  <motion.div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={toggleChat}
                  />

                  {/* Chat panel */}
                  <motion.div
                    className="w-[380px] max-w-[90vw] flex-shrink-0 lg:relative fixed right-0 top-0 bottom-0 z-50 lg:z-auto"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <ChatPanel
                      currentConfig={chartConfig}
                      onConfigChange={setChartConfig}
                      onClose={toggleChat}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
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
      </div>

      {/* Global components */}
      <ToasterProvider />
      <CommandPalette
        onChangeChartType={handleChartTypeChange}
        onToggleDataLabels={handleToggleDataLabels}
      />
    </>
  )
}

export default App