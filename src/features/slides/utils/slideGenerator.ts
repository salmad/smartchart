/**
 * Slide generation utility with dynamic AI-style insights
 * Analyzes data to generate bespoke commentary (3-5 insights)
 */

import type { ChartConfiguration, ChartData } from '@/shared/types/chart'

export interface SlideInsight {
  text: string
}

export interface SlideContent {
  title: string
  subtitle?: string
  chartTitle: string
  chartUnits: string
  insights: SlideInsight[]
}

/**
 * Infer units from chart data
 */
// todo: use llm to infer chart units
function inferUnits(data: ChartData): string {
  const { seriesNames, dataPoints, description } = data

  // Check description first if available
  if (description) {
    const lowerDesc = description.toLowerCase()
    if (lowerDesc.includes('sales') || lowerDesc.includes('revenue') || lowerDesc.includes('price')) {
      return '$'
    }
    if (lowerDesc.includes('percent') || lowerDesc.includes('%')) {
      return '%'
    }
  }

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

// /**
//  * Analyze a single series for trends and patterns
//  */
// function analyzeSeries(
//   dataPoints: ChartDataPoint[],
//   seriesName: string,
//   xAxisKey: string
// ): SeriesAnalysis | null {
//   const values = dataPoints.map(point => point[seriesName] as number).filter(v => typeof v === 'number')
//   const categories = dataPoints.map(point => point[xAxisKey])

//   if (values.length === 0) {
//     return null
//   }

//   const total = values.reduce((sum, val) => sum + val, 0)
//   const average = total / values.length
//   const max = Math.max(...values)
//   const min = Math.min(...values)
//   const maxIndex = values.indexOf(max)
//   const minIndex = values.indexOf(min)

//   // Calculate trend
//   let trend: 'increasing' | 'decreasing' | 'volatile' | 'stable' = 'stable'
//   let growthRate: number | undefined

//   if (values.length > 1) {
//     const firstHalf = values.slice(0, Math.floor(values.length / 2))
//     const secondHalf = values.slice(Math.floor(values.length / 2))
//     const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
//     const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

//     // Calculate volatility (coefficient of variation)
//     const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length)
//     const cv = (stdDev / average) * 100

//     if (cv > 30) {
//       trend = 'volatile'
//     } else if (secondAvg > firstAvg * 1.1) {
//       trend = 'increasing'
//       growthRate = ((secondAvg - firstAvg) / firstAvg) * 100
//     } else if (secondAvg < firstAvg * 0.9) {
//       trend = 'decreasing'
//       growthRate = ((secondAvg - firstAvg) / firstAvg) * 100
//     } else {
//       trend = 'stable'
//     }
//   }

//   return {
//     name: seriesName,
//     values,
//     categories,
//     total,
//     average,
//     max,
//     min,
//     maxCategory: categories[maxIndex],
//     minCategory: categories[minIndex],
//     trend,
//     growthRate,
//   }
// }

// /**
//  * Perform comprehensive data analysis
//  */
// function performDataAnalysis(
//   dataPoints: ChartDataPoint[],
//   seriesNames: string[],
//   xAxisKey: string
// ): DataAnalysis {
//   const series = seriesNames
//     .map(name => analyzeSeries(dataPoints, name, xAxisKey))
//     .filter((s): s is SeriesAnalysis => s !== null)

//   if (series.length === 0) {
//     return { series: [], overallTrend: 'stable' }
//   }

//   // Identify dominant series (highest total)
//   const dominantSeries = series.reduce((best, current) =>
//     current.total > best.total ? current : best
//   )

//   // Identify volatile series
//   const volatileSeries = series.find(s => s.trend === 'volatile')

//   // Identify top performer
//   const topPerformer = series.reduce((best, current) =>
//     current.average > best.average ? current : best
//   )

//   // Identify underperformer
//   const underperformer = series.length > 1 ? series.reduce((worst, current) =>
//     current.average < worst.average ? current : worst
//   ) : undefined

//   // Determine overall trend
//   const growingSeries = series.filter(s => s.trend === 'increasing').length
//   const decliningSeries = series.filter(s => s.trend === 'decreasing').length
//   const totalSeries = series.length

//   let overallTrend: 'growth' | 'decline' | 'mixed' | 'stable' = 'stable'
//   if (growingSeries > totalSeries / 2) {
//     overallTrend = 'growth'
//   } else if (decliningSeries > totalSeries / 2) {
//     overallTrend = 'decline'
//   } else if (growingSeries > 0 || decliningSeries > 0) {
//     overallTrend = 'mixed'
//   }

//   return {
//     series,
//     overallTrend,
//     dominantSeries,
//     volatileSeries,
//     topPerformer,
//     underperformer,
//   }
// }

/**
 * Generate dynamic, AI-style insights (3-5 insights, prefer 3)
 */
// todo: refactor to generate insights by calling llm to analyse data for more flexibility (vs pre-coded analysis)
function generateInsights(data: ChartData): SlideInsight[] {
  const { dataPoints, seriesNames, xAxisKey, description } = data

  try {
    // TODO: This is a placeholder implementation
    // The full analysis code has been commented out pending LLM integration
    // For now, return generic insights based on the data structure
    const insights: SlideInsight[] = []

    if (seriesNames.length > 0) {
      insights.push({
        text: `${seriesNames.length} key metrics tracked across ${dataPoints.length} data points`
      })
    }

    if (dataPoints.length > 0) {
      insights.push({
        text: `Performance trends observable across ${xAxisKey} dimension`
      })
    }

    if (description && description.includes('Objective:')) {
      insights.push({
        text: `Analysis aligned with stated business objectives`
      })
    } else {
      insights.push({
        text: `Strategic opportunities identified for optimization and growth`
      })
    }

    return insights.slice(0, 5) // Maximum 5, prefer 3
  } catch (error) {
    console.error('Error generating insights:', error)
    return [
      { text: 'Data analysis indicates notable patterns worth deeper investigation' },
      { text: 'Performance metrics suggest areas for strategic focus' },
    ]
  }
}


/**
 * Generate action-oriented title (the conclusion) based on insights
 * This is the "so what" that the bullet points will support
 */
// todo: refactor to use LLM for generating action title based on insights and data context
function generateActionTitle(
  _insights: SlideInsight[], // Will be used when LLM integration is implemented
  data: ChartData
): { actionTitle: string; subtitle: string } {
  // TODO: This is a placeholder implementation
  // The full analysis-based logic has been simplified pending LLM integration

  const { seriesNames, xAxisKey, description } = data

  // Extract user objective if present in description
  let userObjective = ''
  if (description) {
    const objectiveMatch = description.match(/(?:objective|goal|aim):\s*(.+?)(?:\.|$)/i)
    if (objectiveMatch) {
      userObjective = objectiveMatch[1].trim()
    }
  }

  // Generate action-oriented title
  const actionTitle = userObjective
    ? `Optimize ${seriesNames[0] || 'performance'} to ${userObjective.toLowerCase()}`
    : `Strategic recommendations based on ${xAxisKey} analysis`

  const subtitle = `Insights from ${seriesNames.length} key metrics`

  return { actionTitle, subtitle }
}

/**
 * Generate slide content from chart configuration
 */
export function generateSlideContent(config: ChartConfiguration): SlideContent {
  const { data, styling } = config
  const { xAxisKey, seriesNames } = data

  // Filter out hidden series
  const visibleSeries = seriesNames.filter(
    name => !styling.hiddenSeries.includes(name)
  )

  // Infer units from data
  const units = inferUnits(data)

  // Generate insights (supporting evidence for the action title)
  const insights = generateInsights(data)

  // Generate action-oriented title (the conclusion)
  const { actionTitle, subtitle } = generateActionTitle(insights, data)

  // Generate chart title (descriptive, not action)
  const chartTitle = styling.title || `${visibleSeries.join(', ')} by ${xAxisKey}`



  return {
    title: actionTitle,
    subtitle: subtitle || undefined,
    chartTitle,
    chartUnits: units,
    insights,
  }
}
