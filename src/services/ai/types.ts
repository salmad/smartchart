import type { ChartConfiguration, ChartData } from '@/shared/types/chart'

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

export interface SlideInsight {
  text: string
}

export interface SlideGenerationResponse {
  success: boolean
  actionTitle?: string
  subtitle?: string
  insights?: SlideInsight[]
  units?: string
  error?: string
}

export interface AIService {
  modifyChart: (config: ChartConfiguration, prompt: string) => Promise<ChatResponse>
  generateSlideInsights?: (data: ChartData) => Promise<SlideGenerationResponse>
  generateActionTitle?: (insights: SlideInsight[], data: ChartData) => Promise<{ actionTitle: string; subtitle: string }>
  inferUnits?: (data: ChartData) => Promise<string>
}
