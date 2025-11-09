import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { BarChart3, LineChart as LineChartIcon, Settings, X, Palette } from 'lucide-react'
import type { ChartConfiguration } from '@/types/chart'
import { getAllPalettes, getPaletteColors } from '@/lib/palettes'

interface SettingsPanelProps {
  config: ChartConfiguration
  onConfigChange: (config: ChartConfiguration) => void
  onClose: () => void
}

export function SettingsPanel({ config, onConfigChange, onClose }: SettingsPanelProps) {
  const { data, styling } = config
  const { seriesNames } = data
  const { chartType, seriesTypes, showDataLabels, selectedPalette } = styling

  // Helper to update styling
  const updateStyling = (updates: Partial<typeof styling>) => {
    onConfigChange({
      ...config,
      styling: { ...styling, ...updates },
    })
  }

  // Handle palette change
  const handlePaletteChange = (paletteId: typeof selectedPalette) => {
    const newColors = getPaletteColors(paletteId)
    updateStyling({
      selectedPalette: paletteId,
      seriesColors: newColors,
    })
  }

  // Get all available palettes
  const palettes = getAllPalettes()
  const currentPalette = palettes.find(p => p.id === selectedPalette)

  return (
    <Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 h-full flex flex-col overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />

      <CardHeader className="space-y-3 pb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Settings
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="transition-smooth hover:bg-slate-100"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          Customize your chart appearance
        </p>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pb-8">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {/* Chart type selector */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Chart Type
              </label>
              <div className="flex flex-col gap-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'bar' })}
                  className="w-full justify-start"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Bar Chart
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'line' })}
                  className="w-full justify-start"
                >
                  <LineChartIcon className="w-4 h-4 mr-2" />
                  Line Chart
                </Button>
                <Button
                  variant={chartType === 'combined' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'combined' })}
                  className="w-full justify-start"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Combined
                </Button>
              </div>
            </div>

            {/* Series type selector (only for combined) */}
            {chartType === 'combined' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Series Types
                </label>
                <div className="space-y-2">
                  {seriesNames.map((name) => (
                    <div key={name} className="space-y-1">
                      <span className="text-slate-600 font-medium text-xs">{name}</span>
                      <div className="flex gap-2">
                        <Button
                          variant={seriesTypes[name] === 'bar' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'bar' } })}
                          className="flex-1 text-xs"
                        >
                          Bar
                        </Button>
                        <Button
                          variant={seriesTypes[name] === 'line' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'line' } })}
                          className="flex-1 text-xs"
                        >
                          Line
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data labels toggle */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Data Labels
              </label>
              <Button
                variant={showDataLabels ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateStyling({ showDataLabels: !showDataLabels })}
                className="w-full"
              >
                {showDataLabels ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* Color Palette Selector - Dropdown */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" />
                Color Palette
              </label>
              <Select value={selectedPalette} onValueChange={handlePaletteChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {currentPalette?.previewColors.slice(0, 4).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-4 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="font-medium">{currentPalette?.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {palettes.map((palette) => (
                    <SelectItem key={palette.id} value={palette.id}>
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex gap-1">
                          {palette.previewColors.slice(0, 4).map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{palette.name}</span>
                          <span className="text-xs text-slate-500">{palette.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 italic">
                💡 Click legend items in the chart to show/hide series
              </p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
