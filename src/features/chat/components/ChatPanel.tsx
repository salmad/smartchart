import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Send, Sparkles, AlertCircle, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { CloseButton } from '@/shared/components/CloseButton'
import { TypingIndicator } from '@/shared/components/TypingIndicator'
import { MarkdownMessage } from '@/shared/components/MarkdownMessage'
import { staggerContainer, staggerItem } from '@/shared/lib/animations'
import { useChatMessages } from '../hooks/useChatMessages'
import { aiService } from '@/services/ai'
import { useChartConfig } from '@/app/providers/ChartConfigProvider'

interface ChatPanelProps {
  onClose?: () => void
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { config, updateConfig } = useChartConfig()
  const { messages, isLoading, sendMessage, setFeedback } = useChatMessages({
    aiService: aiService,
    currentConfig: config,
    onConfigChange: updateConfig,
  })

  const [input, setInput] = useState('')
  const [useWebSearch, setUseWebSearch] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const messageContent = input
    const searchEnabled = useWebSearch
    console.log('ChatPanel.handleSend - Web search enabled:', searchEnabled)
    setInput('')
    setUseWebSearch(false) // Reset toggle after sending (per-message behavior)
    await sendMessage(messageContent, searchEnabled)
  }

  const handleFeedback = (index: number, feedbackType: 'positive' | 'negative') => {
    setFeedback(index, feedbackType)
    toast.success(feedbackType === 'positive' ? 'Thanks for the feedback!' : 'Feedback noted', {
      description: "We'll use this to improve our responses.",
      duration: 2000,
    })
  }

  const retrySend = (messageContent: string) => {
    setInput(messageContent)
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  return (
    <Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 h-full flex flex-col overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

      <CardHeader className="space-y-3 pb-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">AI ASSISTANT</span>
            </div>
            {onClose && <CloseButton onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 transition-smooth" />}
          </div>
          {/* <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Chat Interface
          </CardTitle> */}
          {/* <p className="text-sm text-slate-500 font-medium">Ask anything about your data</p> */}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 pb-6 overflow-hidden">
        <ScrollArea ref={scrollRef} className="flex-1">
          <div className="space-y-4 pr-4">
            {messages.length === 0 ? (
              <motion.div
                className="flex items-center justify-center py-8"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                <div className="text-center space-y-3 max-w-[280px]">
                  <motion.div
                    className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center"
                    variants={staggerItem}
                  >
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </motion.div>
                  <motion.div className="space-y-1.5" variants={staggerItem}>
                    <h3 className="text-base font-semibold text-slate-900">Start chatting</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Try "Change to a line chart" or simply copy-paste your data in any format
                    </p>
                  </motion.div>

                  <motion.div className="flex flex-wrap gap-2 pt-3 justify-center" variants={staggerItem}>
                    {['Change to line chart', 'Hide Product C',
                     'find GDP data for USA from 2020-2023',
                    'AAPL annual revenue and its %% change 2020-2025'].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setInput(prompt)}
                        className="group px-3.5 py-2 rounded-lg bg-slate-50/80 hover:bg-purple-50 border border-slate-200/50 hover:border-purple-300/60 transition-all duration-200"
                      >
                        <span className="text-sm text-slate-600 group-hover:text-purple-700 transition-colors">
                          {prompt}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4 py-2">
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                            : message.isError
                            ? 'bg-rose-50 text-rose-900 border border-rose-200'
                            : 'bg-white/90 backdrop-blur-sm text-slate-900 border border-slate-200/60 shadow-lg'
                        }`}
                      >
                        {message.isError && (
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span className="text-xs font-semibold text-rose-700">Error</span>
                          </div>
                        )}

                        {message.role === 'user' ? (
                          <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                        ) : (
                          <MarkdownMessage content={message.content} />
                        )}

                        {message.isError && (
                          <button
                            onClick={() => retrySend(messages[index - 1]?.content || '')}
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}

                        {message.role === 'assistant' && !message.isError && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200/60">
                            <span className="text-xs text-slate-500 mr-1">Helpful?</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 ${message.feedback === 'positive' ? 'bg-emerald-50 text-emerald-700' : ''}`}
                              onClick={() => handleFeedback(index, 'positive')}
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 ${message.feedback === 'negative' ? 'bg-rose-50 text-rose-700' : ''}`}
                              onClick={() => handleFeedback(index, 'negative')}
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <TypingIndicator />
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSend} className="space-y-2 pt-2">
          {/* Web search toggle */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={useWebSearch ? 'default' : 'outline'}
              onClick={() => setUseWebSearch(!useWebSearch)}
              className={`h-7 px-3 text-xs transition-all ${
                useWebSearch
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md shadow-purple-500/30'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Globe className="h-3 w-3 mr-1.5" />
              Search the web
            </Button>
            {useWebSearch && (
              <span className="text-xs text-slate-500">Web search enabled for this message</span>
            )}
          </div>

          {/* Input and send button */}
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={useWebSearch ? "Ask me to search for data..." : "Describe what you want to see..."}
              disabled={isLoading}
              className="h-12 pl-4 pr-12 rounded-xl border-slate-200 focus:border-purple-400 focus:ring-purple-400/20 transition-all text-sm font-medium placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
