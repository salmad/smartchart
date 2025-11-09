import type { ChartConfiguration } from '@/shared/types/chart'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  feedback?: 'positive' | 'negative'
}

export interface ChatResponse {
  success: boolean
  message: string
  configuration?: ChartConfiguration
}

export interface AIService {
  modifyChart: (config: ChartConfiguration, prompt: string) => Promise<ChatResponse>
}
