/**
 * Slide generation utility for creating McKinsey-style consulting slides
 * Follows Minto Pyramid Principle for structuring insights
 */

import type { ChartConfiguration, ChartDataPoint } from '@/shared/types/chart'

export interface SlideInsight {
  text: string
  type: 'main' | 'supporting'
}

export interface SlideContent {
  title: string
  subtitle?: string
  chartTitle: string
  chartUnits: string
  insights: SlideInsight[]
}

/**
 * Infer units from series names and data values
 */
function inferUnits(seriesNames: string[], dataPoints: ChartDataPoint[]): string {
  // Check series names for common patterns
  const seriesText = seriesNames.join(' ').toLowerCase()

  if (seriesText.includes('sales') || seriesText.includes('revenue') || seriesText.includes('price')) {
    return '$'
  }
  if (seriesText.includes('percent') || seriesText.includes('%')) {
    return '%'
  }
  if (seriesText.includes('count') || seriesText.includes('number')) {
    return 'units'
  }
  if (seriesText.includes('weight')) {
    return 'kg'
  }
  if (seriesText.includes('temperature')) {
    return '°C'
  }

  // Check if values look like currency (large numbers)
  const allValues = dataPoints.flatMap(point =>
    Object.entries(point)
      .filter(([, value]) => typeof value === 'number')
      .map(([, value]) => value as number)
  )

  const maxValue = Math.max(...allValues)
  if (maxValue > 1000) {
    return '$'
  }

  return 'units'
}

/**
 * Calculate statistics for a series
 */
function calculateSeriesStats(
  dataPoints: ChartDataPoint[],
  seriesName: string,
  xAxisKey: string
) {
  const values = dataPoints.map(point => point[seriesName] as number).filter(v => typeof v === 'number')
  const categories = dataPoints.map(point => point[xAxisKey])

  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, val) => sum + val, 0)
  const average = total / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)
  const maxIndex = values.indexOf(max)
  const minIndex = values.indexOf(min)

  return {
    total,
    average,
    max,
    min,
    maxCategory: categories[maxIndex],
    minCategory: categories[minIndex],
    aboveAverage: values.filter(v => v > average).length,
    totalCount: values.length,
  }
}

/**
 * Generate insights following Minto Pyramid Principle
 * Structure: Main message → Key supporting points (max 5 total)
 */
function generateInsights(
  dataPoints: ChartDataPoint[],
  seriesNames: string[],
  xAxisKey: string,
  units: string
): SlideInsight[] {
  const insights: SlideInsight[] = []

  try {
    // Calculate stats for all series
    const allStats = seriesNames
      .map(name => ({
        name,
        stats: calculateSeriesStats(dataPoints, name, xAxisKey),
      }))
      .filter(({ stats }) => stats !== null)

    if (allStats.length === 0) {
      return generateFallbackInsights()
    }

    // 1. Main insight - Total across all series
    const grandTotal = allStats.reduce((sum, { stats }) => sum + (stats?.total || 0), 0)
    insights.push({
      text: `Total combined value: ${formatNumber(grandTotal)} ${units}`,
      type: 'main',
    })

    // 2. Best performer
    const bestSeries = allStats.reduce((best, current) =>
      (current.stats?.total || 0) > (best.stats?.total || 0) ? current : best
    )
    if (bestSeries.stats) {
      insights.push({
        text: `${bestSeries.name} leads with ${formatNumber(bestSeries.stats.total)} ${units}`,
        type: 'supporting',
      })
    }

    // 3. Peak performance
    const peakSeries = allStats.reduce((peak, current) =>
      (current.stats?.max || 0) > (peak.stats?.max || 0) ? current : peak
    )
    if (peakSeries.stats) {
      insights.push({
        text: `Peak: ${peakSeries.name} at ${peakSeries.stats.maxCategory} (${formatNumber(peakSeries.stats.max)} ${units})`,
        type: 'supporting',
      })
    }

    // 4. Average insight
    const overallAverage = grandTotal / allStats.reduce((sum, { stats }) => sum + (stats?.totalCount || 0), 0)
    insights.push({
      text: `Average performance: ${formatNumber(overallAverage)} ${units}`,
      type: 'supporting',
    })

    // 5. Distribution insight
    const aboveAvgCount = allStats.reduce((sum, { stats }) => sum + (stats?.aboveAverage || 0), 0)
    const totalDataPoints = allStats.reduce((sum, { stats }) => sum + (stats?.totalCount || 0), 0)
    insights.push({
      text: `${aboveAvgCount}/${totalDataPoints} data points exceed average`,
      type: 'supporting',
    })
  } catch (error) {
    console.error('Error generating insights:', error)
    return generateFallbackInsights()
  }

  return insights.slice(0, 5) // Max 5 insights
}

/**
 * Generate fallback insights when data analysis fails
 */
function generateFallbackInsights(): SlideInsight[] {
  return [
    { text: 'Chart displays key business metrics', type: 'main' },
    { text: 'Data organized by relevant categories', type: 'supporting' },
    { text: 'Trends visible across time periods', type: 'supporting' },
    { text: 'Performance metrics clearly visualized', type: 'supporting' },
  ]
}

/**
 * Format number with commas for readability
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/**
 * Generate slide content from chart configuration
 */
export function generateSlideContent(config: ChartConfiguration): SlideContent {
  const { data, styling } = config
  const { dataPoints, xAxisKey, seriesNames } = data
  const { title, subtitle } = styling

  // Filter out hidden series
  const visibleSeries = seriesNames.filter(
    name => !styling.hiddenSeries.includes(name)
  )

  // Infer units
  const units = inferUnits(visibleSeries, dataPoints)

  // Generate chart title
  const chartTitle = title || `${visibleSeries.join(', ')} by ${xAxisKey}`

  // Generate insights
  const insights = generateInsights(dataPoints, visibleSeries, xAxisKey, units)

  return {
    title: title || 'Performance Analysis',
    subtitle: subtitle || undefined,
    chartTitle,
    chartUnits: units,
    insights,
  }
}
