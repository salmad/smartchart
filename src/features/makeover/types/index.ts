// Types for Chart Makeover feature

export interface ExtractedChartData {
  chartType: 'bar' | 'line' | 'pie' | 'combined'
  title?: string
  subtitle?: string
  xAxisLabel?: string
  yAxisLabel?: string
  series: ChartSeries[]
  confidence: number // 0-1, how confident AI is in extraction
}

export interface ChartSeries {
  name: string
  data: DataPoint[]
}

export interface DataPoint {
  x: string
  y: number
}

export interface MakeoverState {
  status: 'idle' | 'processing' | 'complete' | 'error'
  originalImage: string | null
  extractedData: ExtractedChartData | null
  error: string | null
}
