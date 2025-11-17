import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { BarChart3, LineChart as LineChartIcon, Settings, Palette, ChevronDown, ChevronRight } from 'lucide-react'
import { CloseButton } from '@/shared/components/CloseButton'
import { getAllPalettes, getPaletteColors } from '@/shared/lib/palettes'
import { useChartConfig } from '@/app/providers/ChartConfigProvider'
import type { ColorPalette, ChartType } from '@/shared/types/chart'
import { useState } from 'react'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { config, updateStyling, setChartType, toggleDataLabels, setAxisRange, clearAxisRange, setSeriesYAxis } = useChartConfig()
  const { data, styling } = config
  const { seriesNames } = data
  const { chartType, seriesTypes, seriesYAxis, showDataLabels, selectedPalette, yMin, yMax, xMin, xMax, yMinRight, yMaxRight } = styling

  // Collapsible sections state
  const [showYAxisAssignment, setShowYAxisAssignment] = useState(false)
  const [showAxisRanges, setShowAxisRanges] = useState(false)

  // Check if any series use right Y-axis
  const hasRightYAxis = seriesNames.some(name => seriesYAxis[name] === 'right')

  const handlePaletteChange = (paletteId: ColorPalette) => {
    const newColors = getPaletteColors(paletteId)
    updateStyling({
      selectedPalette: paletteId,
      seriesColors: newColors,
    })
  }

  const palettes = getAllPalettes()
  const currentPalette = palettes.find((p) => p.id === selectedPalette)

  return (
    <Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 h-[750px] flex flex-col overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />

      <CardHeader className="space-y-3 pb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Settings
            </CardTitle>
          </div>
          <CloseButton onClick={onClose} className="transition-smooth hover:bg-slate-100" />
        </div>
        <p className="text-sm text-slate-500 font-medium">Customize your chart appearance</p>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pb-8">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-5">
            {/* Chart Type - Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Chart Type</label>
              <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Bar Chart</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="line">
                    <div className="flex items-center gap-2">
                      <LineChartIcon className="w-4 h-4" />
                      <span>Line Chart</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="combined">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Combined</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Series Type Selector - Compact (only for combined) */}
            {chartType === 'combined' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Series Types</label>
                <div className="space-y-2">
                  {seriesNames.map((name) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium text-xs">{name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant={seriesTypes[name] === 'bar' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'bar' } })}
                          className="h-7 px-3 text-xs"
                        >
                          Bar
                        </Button>
                        <Button
                          variant={seriesTypes[name] === 'line' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'line' } })}
                          className="h-7 px-3 text-xs"
                        >
                          Line
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Y-Axis Assignment - Collapsible */}
            <div className="space-y-2">
              <button
                onClick={() => setShowYAxisAssignment(!showYAxisAssignment)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wide hover:text-slate-900 transition-smooth"
              >
                <span>Y-Axis Assignment</span>
                {showYAxisAssignment ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showYAxisAssignment && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-slate-500 italic">
                    Use dual Y-axes when series have different units
                  </p>
                  {seriesNames.map((name) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium text-xs">{name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant={seriesYAxis[name] === 'left' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSeriesYAxis(name, 'left')}
                          className="h-7 px-3 text-xs"
                        >
                          Left
                        </Button>
                        <Button
                          variant={seriesYAxis[name] === 'right' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSeriesYAxis(name, 'right')}
                          className="h-7 px-3 text-xs"
                        >
                          Right
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data Labels Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Data Labels</label>
              <Button
                variant={showDataLabels ? 'default' : 'outline'}
                size="sm"
                onClick={toggleDataLabels}
                className="h-7 px-4 text-xs"
              >
                {showDataLabels ? 'ON' : 'OFF'}
              </Button>
            </div>

            <Separator />

            {/* Color Palette */}
            <div className="space-y-2">
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

            <Separator />

            {/* Axis Ranges - Collapsible Advanced Section */}
            <div className="space-y-2">
              <button
                onClick={() => setShowAxisRanges(!showAxisRanges)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wide hover:text-slate-900 transition-smooth"
              >
                <span>Axis Ranges (Advanced)</span>
                {showAxisRanges ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showAxisRanges && (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearAxisRange()}
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Reset All
                    </Button>
                  </div>

                  {/* Y-axis Left */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Y-Axis Left</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAxisRange('y')}
                        className="h-5 px-2 text-xs text-slate-500"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={yMin ?? ''}
                        onChange={(e) => setAxisRange('yMin', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={yMax ?? ''}
                        onChange={(e) => setAxisRange('yMax', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Y-axis Right - Only show when hasRightYAxis */}
                  {hasRightYAxis && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Y-Axis Right</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearAxisRange('yRight')}
                          className="h-5 px-2 text-xs text-slate-500"
                        >
                          Clear
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={yMinRight ?? ''}
                          onChange={(e) => setAxisRange('yMinRight', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={yMaxRight ?? ''}
                          onChange={(e) => setAxisRange('yMaxRight', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* X-axis */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">X-Axis</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAxisRange('x')}
                        className="h-5 px-2 text-xs text-slate-500"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={xMin ?? ''}
                        onChange={(e) => setAxisRange('xMin', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={xMax ?? ''}
                        onChange={(e) => setAxisRange('xMax', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500 italic">💡 Click legend items in the chart to show/hide series</p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
