import type { ChartConfiguration, ChartData } from '@/shared/types/chart'

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
  modifyChart: (config: ChartConfiguration, prompt: string, useWebSearch?: boolean) => Promise<ChatResponse>
  generateSlideInsights?: (data: ChartData) => Promise<SlideGenerationResponse>
  generateActionTitle?: (insights: SlideInsight[], data: ChartData) => Promise<{ actionTitle: string; subtitle: string }>
  inferUnits?: (data: ChartData) => Promise<string>
}
