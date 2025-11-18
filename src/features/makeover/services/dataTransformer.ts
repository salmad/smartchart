import type { ExtractedChartData } from '../types'
import type { ChartConfiguration, ChartType, SeriesType, SeriesColor } from '@/shared/types/chart'

/**
 * Transform extracted chart data to SmartChart's ChartConfiguration format
 */
export function transformToChartConfig(extractedData: ExtractedChartData): ChartConfiguration {
  const { chartType, title, subtitle, xAxisLabel, series } = extractedData

  // Build the data array for Recharts
  // Recharts expects: [{ quarter: 'Q1', 'Product A': 240, 'Product B': 139 }, ...]
  const dataPoints = new Map<string, Record<string, number | string>>()

  // Collect all unique x values
  series.forEach(s => {
    s.data.forEach(point => {
      if (!dataPoints.has(point.x)) {
        dataPoints.set(point.x, { [xAxisLabel || 'category']: point.x })
      }
      const existing = dataPoints.get(point.x)!
      existing[s.name] = point.y
    })
  })

  const dataPointsArray = Array.from(dataPoints.values())

  // Determine series names and types
  const seriesNames = series.map(s => s.name)
  const seriesTypes: Record<string, SeriesType> = {}
  const seriesYAxis: Record<string, 'left' | 'right'> = {}

  // Map chart type
  let finalChartType: ChartType = chartType === 'pie' ? 'bar' : chartType as ChartType

  if (chartType === 'combined') {
    // For combined charts, alternate between bar and line
    seriesNames.forEach((name, index) => {
      seriesTypes[name] = index % 2 === 0 ? 'bar' : 'line'
      seriesYAxis[name] = 'left'
    })
  } else if (chartType === 'line') {
    seriesNames.forEach(name => {
      seriesTypes[name] = 'line'
      seriesYAxis[name] = 'left'
    })
  } else {
    seriesNames.forEach(name => {
      seriesTypes[name] = 'bar'
      seriesYAxis[name] = 'left'
    })
  }

  // Default premium color palette
  const seriesColors: SeriesColor[] = [
    { gradient: 'colorA', solid: 'hsl(262, 80%, 60%)' },  // Vibrant Purple
    { gradient: 'colorB', solid: 'hsl(199, 89%, 48%)' },  // Ocean Blue
    { gradient: 'colorC', solid: 'hsl(142, 71%, 45%)' },  // Emerald Green
    { gradient: 'colorD', solid: 'hsl(280, 65%, 60%)' },  // Rich Violet
  ]

  return {
    data: {
      dataPoints: dataPointsArray,
      xAxisKey: xAxisLabel || 'category',
      seriesNames
    },
    styling: {
      chartType: finalChartType,
      seriesTypes,
      seriesYAxis,
      seriesColors,
      hiddenSeries: [],
      showDataLabels: false,
      title: title || 'Chart Makeover',
      subtitle: subtitle || 'Transformed with SmartChart',
      selectedPalette: 'founder'
    }
  }
}
