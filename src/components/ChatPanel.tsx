import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Send, Sparkles, AlertCircle, RefreshCw, ThumbsUp, ThumbsDown, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { modifyChart } from '@/lib/gemini'
import type { ChartConfiguration } from '@/types/chart'
import { TypingIndicator } from './TypingIndicator'
import { MarkdownMessage } from './MarkdownMessage'
import { staggerContainer, staggerItem } from '@/utils/animations'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  feedback?: 'positive' | 'negative'
}

interface ChatPanelProps {
  currentConfig: ChartConfiguration
  onConfigChange: (config: ChartConfiguration) => void
  onClose?: () => void
}

export function ChatPanel({ currentConfig, onConfigChange, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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

    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    const messageContent = input
    setInput('')
    setIsLoading(true)

    // Show toast for user action
    toast.success('Message sent', {
      description: 'AI is analyzing your request...',
      duration: 2000
    })

    try {
      const result = await modifyChart(currentConfig, messageContent)

      if (result.success && result.configuration) {
        // Apply the new configuration
        onConfigChange(result.configuration)

        // Add success message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.message },
        ])

        // Success toast
        toast.success('Chart updated!', {
          description: result.message,
          duration: 3000
        })
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.message, isError: true },
        ])

        // Error toast
        toast.error('Could not update chart', {
          description: result.message,
          duration: 4000
        })
      }
    } catch (error) {
      const errorMessage = 'Something went wrong. Please try again.'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          isError: true,
        },
      ])

      toast.error('Request failed', {
        description: errorMessage,
        duration: 4000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = (index: number, feedbackType: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === index ? { ...msg, feedback: feedbackType } : msg
      )
    )

    toast.success(feedbackType === 'positive' ? 'Thanks for the feedback!' : 'Feedback noted', {
      description: 'We\'ll use this to improve our responses.',
      duration: 2000
    })
  }

  const retrySend = (messageContent: string) => {
    setInput(messageContent)
    // Trigger send after setting input
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  return (
    <Card className="glass border-l-2 border-slate-200/60 shadow-2xl shadow-blue-500/10 transition-smooth flex flex-col h-full lg:h-[600px] overflow-hidden rounded-l-none lg:rounded-l-none rounded-l-2xl">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

      <CardHeader className="space-y-3 pb-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">AI ASSISTANT</span>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 transition-smooth"
                aria-label="Close AI Assistant"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Chat Interface
          </CardTitle>
          <p className="text-sm text-slate-500 font-medium">Ask anything about your data</p>
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
                      Try "Change to a line chart" or "Show Product A only"
                    </p>
                  </motion.div>

                  {/* Suggested prompts */}
                  <motion.div
                    className="flex flex-wrap gap-2 pt-3 justify-center"
                    variants={staggerItem}
                  >
                    {[
                      'Change to line chart',
                      'Hide Product C',
                      'Only Q1 and Q2'
                    ].map((prompt) => (
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

                        {/* Feedback buttons for assistant messages */}
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

                {/* Typing indicator */}
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

        <form onSubmit={handleSend} className="flex gap-3 pt-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to see..."
              disabled={isLoading}
              className="h-12 pl-4 pr-12 rounded-xl border-slate-200 focus:border-purple-400 focus:ring-purple-400/20 transition-all text-sm font-medium placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        
        
      </CardContent>
    </Card>
  )
}