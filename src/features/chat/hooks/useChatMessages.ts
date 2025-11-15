import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { Message, WebSource } from '@/services/ai'
import type { AIService } from '@/services/ai'
import type { ChartConfiguration } from '@/shared/types/chart'

interface UseChatMessagesOptions {
  aiService: AIService
  currentConfig: ChartConfiguration
  onConfigChange: (config: ChartConfiguration, sources?: WebSource[]) => void
}

export function useChatMessages({
  aiService,
  currentConfig,
  onConfigChange,
}: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(
    async (content: string, useWebSearch = false) => {
      if (!content.trim() || isLoading) return

      const userMessage: Message = { role: 'user', content }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      toast.success('Message sent', {
        description: useWebSearch ? 'AI is searching the web and analyzing...' : 'AI is analyzing your request...',
        duration: 2000,
      })

      try {
        const result = await aiService.modifyChart(currentConfig, content, useWebSearch)

        if (result.success && result.configuration) {
          console.log('useChatMessages: Received sources from AI:', result.sources)

          // Pass both configuration and sources to the config provider
          onConfigChange(result.configuration, result.sources)

          const assistantMessage: Message = {
            role: 'assistant',
            content: result.message,
          }

          // Include sources if they were returned
          if (result.sources && result.sources.length > 0) {
            assistantMessage.sources = result.sources
            console.log('useChatMessages: Added sources to assistant message:', assistantMessage.sources)
          }

          setMessages((prev) => [...prev, assistantMessage])

          toast.success('Chart updated!', {
            description: result.message,
            duration: 3000,
          })
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: result.message, isError: true },
          ])

          toast.error('Could not update chart', {
            description: result.message,
            duration: 4000,
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
          duration: 4000,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [aiService, currentConfig, onConfigChange, isLoading]
  )

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user')

    if (lastUserMessage) {
      // Remove the last assistant error message
      setMessages((prev) => prev.slice(0, -1))
      sendMessage(lastUserMessage.content)
    }
  }, [messages, sendMessage])

  const setFeedback = useCallback((messageIndex: number, feedback: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === messageIndex ? { ...msg, feedback } : msg
      )
    )
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    retryLastMessage,
    setFeedback,
    clearMessages,
  }
}
