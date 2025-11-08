// Chart configuration types split into data and styling

export type ChartType = 'bar' | 'line' | 'combined'
export type SeriesType = 'bar' | 'line'
export type ColorPalette = 'founder' | 'executive' | 'arctic' | 'revolut' | 'linear'

export interface ChartDataPoint {
  [key: string]: string | number
}

export interface ChartData {
  dataPoints: ChartDataPoint[]
  xAxisKey: string
  seriesNames: string[]
}

export interface SeriesColor {
  gradient: string
  solid: string
}

export interface ChartStyling {
  chartType: ChartType
  seriesTypes: Record<string, SeriesType>
  seriesColors: SeriesColor[]
  hiddenSeries: string[]
  showDataLabels: boolean
  title: string
  subtitle: string
  selectedPalette: ColorPalette
}

export interface ChartConfiguration {
  data: ChartData
  styling: ChartStyling
}
