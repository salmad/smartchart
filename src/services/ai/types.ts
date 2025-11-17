import type { ChartConfiguration } from '@/shared/types/chart'

export interface WebSource {
  title: string
  url: string
  description?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  feedback?: 'positive' | 'negative'
  sources?: WebSource[]
}

export interface ChatResponse {
  success: boolean
  message: string
  configuration?: ChartConfiguration
  sources?: WebSource[]
}

export interface AIService {
  modifyChart: (config: ChartConfiguration, prompt: string, useWebSearch?: boolean) => Promise<ChatResponse>
}
