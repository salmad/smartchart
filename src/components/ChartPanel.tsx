import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { BarChart3, LineChart as LineChartIcon, Settings, Palette } from 'lucide-react'
import type { ChartConfiguration } from '@/types/chart'
import { getAllPalettes, getPaletteColors } from '@/lib/palettes'

interface ChartPanelProps {
  config: ChartConfiguration
  onConfigChange: (config: ChartConfiguration) => void
}

export function ChartPanel({ config, onConfigChange }: ChartPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showControls, setShowControls] = useState(false)

  // Destructure from config for easier access
  const { data, styling } = config
  const { dataPoints, xAxisKey, seriesNames } = data
  const { chartType, seriesTypes, seriesColors, hiddenSeries, showDataLabels, title, subtitle, selectedPalette } = styling

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

  const toggleSeries = (seriesName: string) => {
    const newHiddenSeries = [...hiddenSeries]
    const index = newHiddenSeries.indexOf(seriesName)

    if (index > -1) {
      newHiddenSeries.splice(index, 1)
    } else {
      newHiddenSeries.push(seriesName)
    }

    updateStyling({ hiddenSeries: newHiddenSeries })
  }

  const handleLegendClick = (data: any) => {
    if (data && data.dataKey) {
      toggleSeries(data.dataKey)
    }
  }

  const renderChart = () => {
    const commonProps = {
      data: dataPoints,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    }

    const renderGradients = () => (
      <defs>
        {seriesColors.map((color) => (
          <linearGradient key={color.gradient} id={color.gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color.solid} stopOpacity={0.9}/>
            <stop offset="95%" stopColor={color.solid} stopOpacity={0.7}/>
          </linearGradient>
        ))}
      </defs>
    )

    const renderSeries = () => seriesNames.map((name, idx) => {
      if (hiddenSeries.includes(name)) return null
      
      const color = seriesColors[idx]
      const type = chartType === 'combined' ? seriesTypes[name] : chartType
      const fillColor = type === 'bar' ? `url(#${color.gradient})` : 'none'
      const strokeColor = color.solid
      
      const commonSeriesProps = {
        key: name,
        dataKey: name,
        strokeWidth: 2,
      }

      if (type === 'bar') {
        return (
          <Bar 
            {...commonSeriesProps}
            fill={fillColor}
            radius={[8, 8, 0, 0]}
          >
            {showDataLabels && (
              <LabelList 
                position="top" 
                style={{ fontSize: '11px', fontWeight: 600, fill: '#64748b' }}
              />
            )}
          </Bar>
        )
      } else {
        return (
          <Line 
            {...commonSeriesProps}
            type="monotone"
            stroke={strokeColor}
            strokeWidth={3}
            dot={{ fill: strokeColor, r: 4 }}
            activeDot={{ r: 6 }}
          >
            {showDataLabels && (
              <LabelList 
                position="top" 
                style={{ fontSize: '11px', fontWeight: 600, fill: '#64748b' }}
              />
            )}
          </Line>
        )
      }
    })

    const ChartComponent = chartType === 'combined' ? ComposedChart : (chartType === 'line' ? LineChart : BarChart)

    return (
      <ResponsiveContainer width="100%" height={420}>
        <ChartComponent {...commonProps}>
          {renderGradients()}
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e2e8f0" 
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey={xAxisKey}
            stroke="#64748b"
            style={{ fontSize: '13px', fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis 
            stroke="#64748b"
            style={{ fontSize: '12px', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
              padding: '12px',
            }}
            cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
            labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}
            itemStyle={{ fontSize: '13px', fontWeight: 600 }}
          />
          <Legend 
            onClick={handleLegendClick}
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            iconType="circle"
            formatter={(value) => (
              <span style={{ opacity: hiddenSeries.includes(value) ? 0.3 : 1 }}>
                {value}
              </span>
            )}
          />
          {renderSeries()}
        </ChartComponent>
      </ResponsiveContainer>
    )
  }

  return (
    <Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 group hover:shadow-purple-500/20 transition-smooth overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
      
      <CardHeader className="space-y-3 pb-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-purple-600 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              LIVE DATA
            </div>
            
            {isEditingTitle ? (
              <div className="space-y-2">
                <Input
                  value={title}
                  onChange={(e) => updateStyling({ title: e.target.value })}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  className="text-3xl font-bold h-12"
                  autoFocus
                />
                <Input
                  value={subtitle}
                  onChange={(e) => updateStyling({ subtitle: e.target.value })}
                  className="text-sm"
                  placeholder="Subtitle"
                />
              </div>
            ) : (
              <div onClick={() => setIsEditingTitle(true)} className="cursor-pointer">
                <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent hover:opacity-70 transition-smooth">
                  {title}
                </CardTitle>
                <p className="text-sm text-slate-500 font-medium hover:text-slate-700 transition-smooth">{subtitle}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Controls toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowControls(!showControls)}
              className="transition-smooth"
            >
              <Settings className="w-4 h-4" />
            </Button>
            
            {/* Metrics badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs font-bold text-emerald-700">+24%</span>
            </div>
          </div>
        </div>

        {/* Controls panel */}
        {showControls && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Chart type selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Chart Type</label>
              <div className="flex gap-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'bar' })}
                  className="flex-1"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'line' })}
                  className="flex-1"
                >
                  <LineChartIcon className="w-4 h-4 mr-2" />
                  Line
                </Button>
                <Button
                  variant={chartType === 'combined' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStyling({ chartType: 'combined' })}
                  className="flex-1"
                >
                  Combined
                </Button>
              </div>
            </div>

            {/* Series type selector (only for combined) */}
            {chartType === 'combined' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Series Types</label>
                <div className="grid grid-cols-2 gap-2">
                  {seriesNames.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-600 font-medium text-xs flex-1">{name}</span>
                      <Button
                        variant={seriesTypes[name] === 'bar' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'bar' } })}
                        className="h-7 px-2 text-xs"
                      >
                        Bar
                      </Button>
                      <Button
                        variant={seriesTypes[name] === 'line' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateStyling({ seriesTypes: { ...seriesTypes, [name]: 'line' } })}
                        className="h-7 px-2 text-xs"
                      >
                        Line
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data labels toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Data Labels</label>
              <Button
                variant={showDataLabels ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateStyling({ showDataLabels: !showDataLabels })}
              >
                {showDataLabels ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* Color Palette Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" />
                Color Palette
              </label>
              <div className="grid grid-cols-1 gap-2">
                {palettes.map((palette) => (
                  <button
                    key={palette.id}
                    onClick={() => handlePaletteChange(palette.id)}
                    className={`
                      group relative p-3 rounded-lg border-2 transition-smooth text-left
                      ${selectedPalette === palette.id
                        ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg shadow-purple-500/20'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-slate-900">{palette.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{palette.description}</div>
                      </div>
                      {selectedPalette === palette.id && (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {palette.previewColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full border-2 border-white shadow-md transition-smooth group-hover:scale-110"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 italic">💡 Click legend items to show/hide series</p>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pb-8">
        <div className="relative">
          {/* Premium chart container */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50/50 to-white p-6 border border-slate-100">
            {renderChart()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}