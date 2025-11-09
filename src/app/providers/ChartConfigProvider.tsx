import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import type { ChartConfiguration, ChartStyling, ChartData, ChartType, ColorPalette } from '@/shared/types/chart'

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
  updateConfig: (config: ChartConfiguration) => void
  updateStyling: (updates: Partial<ChartStyling>) => void
  updateData: (updates: Partial<ChartData>) => void
  setChartType: (type: ChartType) => void
  toggleDataLabels: () => void
  toggleSeries: (seriesName: string) => void
  setPalette: (palette: ColorPalette) => void
  setTitle: (title: string) => void
  setSubtitle: (subtitle: string) => void
  resetConfig: () => void
}

const ChartConfigContext = createContext<ChartConfigContextValue | null>(null)

export function ChartConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChartConfiguration>(initialConfig)

  // Update entire config
  const updateConfig = useCallback((newConfig: ChartConfiguration) => {
    setConfig(newConfig)
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

  // Reset to initial config
  const resetConfig = useCallback(() => {
    setConfig(initialConfig)
  }, [])

  const value = useMemo(
    () => ({
      config,
      updateConfig,
      updateStyling,
      updateData,
      setChartType,
      toggleDataLabels,
      toggleSeries,
      setPalette,
      setTitle,
      setSubtitle,
      resetConfig,
    }),
    [
      config,
      updateConfig,
      updateStyling,
      updateData,
      setChartType,
      toggleDataLabels,
      toggleSeries,
      setPalette,
      setTitle,
      setSubtitle,
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
