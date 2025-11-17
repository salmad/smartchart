import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import type { ChartConfiguration, ChartStyling, ChartData, ChartType, ColorPalette, YAxisId } from '@/shared/types/chart'
import type { WebSource } from '@/services/ai'

// Initial chart configuration
const initialConfig: ChartConfiguration = {
  data: {
    dataPoints: [
      { quarter: 'Q1', 'Product A': 240, 'Product B': 139, 'Product C': 120, 'Product D': 180 },
      { quarter: 'Q2', 'Product A': 300, 'Product B': 200, 'Product C': 150, 'Product D': 220 },
      { quarter: 'Q3', 'Product A': 200, 'Product B': 278, 'Product C': 190, 'Product D': 250 },
      { quarter: 'Q4', 'Product A': 278, 'Product B': 189, 'Product C': 240, 'Product D': 300 },
    ],
    xAxisKey: 'quarter',
    seriesNames: ['Product A', 'Product B', 'Product C', 'Product D'],
  },
  styling: {
    chartType: 'bar',
    seriesTypes: {
      'Product A': 'bar',
      'Product B': 'bar',
      'Product C': 'bar',
      'Product D': 'bar',
    },
    seriesYAxis: {
      'Product A': 'left',
      'Product B': 'left',
      'Product C': 'left',
      'Product D': 'left',
    },
    seriesColors: [
      { gradient: 'colorA', solid: 'hsl(262, 80%, 60%)' },  // Vibrant Purple
      { gradient: 'colorB', solid: 'hsl(199, 89%, 48%)' },  // Ocean Blue
      { gradient: 'colorC', solid: 'hsl(142, 71%, 45%)' },  // Emerald Green
      { gradient: 'colorD', solid: 'hsl(280, 65%, 60%)' },  // Rich Violet
    ],
    hiddenSeries: [],
    showDataLabels: false,
    title: 'Quarterly Performance',
    subtitle: 'Sales by product across Q1-Q4',
    selectedPalette: 'founder',
  },
}

interface ChartConfigContextValue {
  config: ChartConfiguration
  sources: WebSource[]
  updateConfig: (config: ChartConfiguration, sources?: WebSource[]) => void
  updateStyling: (updates: Partial<ChartStyling>) => void
  updateData: (updates: Partial<ChartData>) => void
  setChartType: (type: ChartType) => void
  toggleDataLabels: () => void
  toggleSeries: (seriesName: string) => void
  setPalette: (palette: ColorPalette) => void
  setTitle: (title: string) => void
  setSubtitle: (subtitle: string) => void
  setSources: (sources: WebSource[]) => void
  setAxisRange: (axis: 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'yMinRight' | 'yMaxRight', value: number | undefined) => void
  clearAxisRange: (axis?: 'x' | 'y' | 'yRight') => void
  setSeriesYAxis: (seriesName: string, yAxisId: YAxisId) => void
  resetConfig: () => void
}

const ChartConfigContext = createContext<ChartConfigContextValue | null>(null)

export function ChartConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChartConfiguration>(initialConfig)
  const [sources, setSources] = useState<WebSource[]>([])

  // Update entire config and optionally sources
  const updateConfig = useCallback((newConfig: ChartConfiguration, newSources?: WebSource[]) => {
    console.log('ChartConfigProvider.updateConfig called with sources:', newSources)
    setConfig(newConfig)
    // Always update sources - either to new sources or empty array
    setSources(newSources || [])
    console.log('Sources updated to:', newSources || [])
  }, [])

  // Update styling properties
  const updateStyling = useCallback((updates: Partial<ChartStyling>) => {
    setConfig(prev => ({
      ...prev,
      styling: { ...prev.styling, ...updates }
    }))
  }, [])

  // Update data properties
  const updateData = useCallback((updates: Partial<ChartData>) => {
    setConfig(prev => ({
      ...prev,
      data: { ...prev.data, ...updates }
    }))
  }, [])

  // Set chart type
  const setChartType = useCallback((type: ChartType) => {
    updateStyling({ chartType: type })
  }, [updateStyling])

  // Toggle data labels
  const toggleDataLabels = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      styling: {
        ...prev.styling,
        showDataLabels: !prev.styling.showDataLabels
      }
    }))
  }, [])

  // Toggle series visibility
  const toggleSeries = useCallback((seriesName: string) => {
    setConfig(prev => {
      const hiddenSeries = [...prev.styling.hiddenSeries]
      const index = hiddenSeries.indexOf(seriesName)

      if (index > -1) {
        hiddenSeries.splice(index, 1)
      } else {
        hiddenSeries.push(seriesName)
      }

      return {
        ...prev,
        styling: {
          ...prev.styling,
          hiddenSeries
        }
      }
    })
  }, [])

  // Set color palette
  const setPalette = useCallback((palette: ColorPalette) => {
    updateStyling({ selectedPalette: palette })
  }, [updateStyling])

  // Set title
  const setTitle = useCallback((title: string) => {
    updateStyling({ title })
  }, [updateStyling])

  // Set subtitle
  const setSubtitle = useCallback((subtitle: string) => {
    updateStyling({ subtitle })
  }, [updateStyling])

  // Set axis range value (min or max for x or y axis)
  const setAxisRange = useCallback((axis: 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'yMinRight' | 'yMaxRight', value: number | undefined) => {
    updateStyling({ [axis]: value })
  }, [updateStyling])

  // Clear axis range (revert to auto-scaling)
  const clearAxisRange = useCallback((axis?: 'x' | 'y' | 'yRight') => {
    if (axis === 'x') {
      updateStyling({ xMin: undefined, xMax: undefined })
    } else if (axis === 'y') {
      updateStyling({ yMin: undefined, yMax: undefined })
    } else if (axis === 'yRight') {
      updateStyling({ yMinRight: undefined, yMaxRight: undefined })
    } else {
      // Clear all axes
      updateStyling({ xMin: undefined, xMax: undefined, yMin: undefined, yMax: undefined, yMinRight: undefined, yMaxRight: undefined })
    }
  }, [updateStyling])

  // Set Y-axis assignment for a series
  const setSeriesYAxis = useCallback((seriesName: string, yAxisId: YAxisId) => {
    setConfig(prev => ({
      ...prev,
      styling: {
        ...prev.styling,
        seriesYAxis: {
          ...prev.styling.seriesYAxis,
          [seriesName]: yAxisId
        }
      }
    }))
  }, [])

  // Reset to initial config
  const resetConfig = useCallback(() => {
    setConfig(initialConfig)
    setSources([])
  }, [])

  const value = useMemo(
    () => ({
      config,
      sources,
      updateConfig,
      updateStyling,
      updateData,
      setChartType,
      toggleDataLabels,
      toggleSeries,
      setPalette,
      setTitle,
      setSubtitle,
      setSources,
      setAxisRange,
      clearAxisRange,
      setSeriesYAxis,
      resetConfig,
    }),
    [
      config,
      sources,
      updateConfig,
      updateStyling,
      updateData,
      setChartType,
      toggleDataLabels,
      toggleSeries,
      setPalette,
      setTitle,
      setSubtitle,
      setAxisRange,
      clearAxisRange,
      setSeriesYAxis,
      resetConfig,
    ]
  )

  return (
    <ChartConfigContext.Provider value={value}>
      {children}
    </ChartConfigContext.Provider>
  )
}

export function useChartConfig() {
  const context = useContext(ChartConfigContext)
  if (!context) {
    throw new Error('useChartConfig must be used within ChartConfigProvider')
  }
  return context
}
