import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Send, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { modifyChart } from '@/lib/gemini'
import type { ChartConfiguration } from '@/types/chart'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

interface ChatPanelProps {
  currentConfig: ChartConfiguration
  onConfigChange: (config: ChartConfiguration) => void
}

export function ChatPanel({ currentConfig, onConfigChange }: ChatPanelProps) {
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
    setInput('')
    setIsLoading(true)

    try {
      const result = await modifyChart(currentConfig, input)

      if (result.success && result.configuration) {
        // Apply the new configuration
        onConfigChange(result.configuration)

        // Add success message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.message },
        ])
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result.message, isError: true },
        ])
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
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
    <Card className="glass border-slate-200/60 shadow-2xl shadow-blue-500/10 group hover:shadow-blue-500/20 transition-smooth flex flex-col h-[680px] overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
      
      <CardHeader className="space-y-3 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-600">AI ASSISTANT</span>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Chat Interface
          </CardTitle>
          <p className="text-sm text-slate-500 font-medium">Ask anything about your data</p>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 pb-6 overflow-hidden">
        <ScrollArea ref={scrollRef} className="flex-1">
          <div className="space-y-4 pr-4">
            {messages.length === 0 ? (
              <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">Start a conversation</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Try asking: "Change to a line chart" or "Show only Product A"
                    </p>
                  </div>

                  {/* Suggested prompts */}
                  <div className="flex flex-wrap gap-2 justify-center pt-4">
                    {['Change to line chart', 'Add more data points', 'Change colors'].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setInput(prompt)}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                          : message.isError
                          ? 'bg-rose-50 text-rose-900 border border-rose-200'
                          : 'bg-slate-100 text-slate-900 border border-slate-200'
                      }`}
                    >
                      {message.isError && (
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span className="text-xs font-semibold text-rose-700">Error</span>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                      {message.isError && (
                        <button
                          onClick={() => retrySend(messages[index - 1]?.content || '')}
                          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-slate-100 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Analyzing your request...</p>
                      </div>
                    </div>
                  </div>
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
        
        {/* Quick actions */}
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
          <span>Quick actions:</span>
          <div className="flex gap-1.5">
            {[{ emoji: '📊', label: 'Chart types' }, { emoji: '📈', label: 'Analytics' }, { emoji: '🎨', label: 'Styling' }].map((action, i) => (
              <button
                key={i}
                aria-label={action.label}
                className="w-6 h-6 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center"
              >
                {action.emoji}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}