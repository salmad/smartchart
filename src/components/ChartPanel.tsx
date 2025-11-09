import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { Settings } from 'lucide-react'
import type { ChartConfiguration } from '@/types/chart'

interface ChartPanelProps {
  config: ChartConfiguration
  onConfigChange: (config: ChartConfiguration) => void
  onOpenSettings?: () => void
}

export function ChartPanel({ config, onConfigChange, onOpenSettings }: ChartPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  // Destructure from config for easier access
  const { data, styling } = config
  const { dataPoints, xAxisKey, seriesNames } = data
  const { chartType, seriesTypes, seriesColors, hiddenSeries, showDataLabels, title, subtitle } = styling

  // Helper to update styling
  const updateStyling = (updates: Partial<typeof styling>) => {
    onConfigChange({
      ...config,
      styling: { ...styling, ...updates },
    })
  }

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
        dataKey: name,
        strokeWidth: 2,
      }

      if (type === 'bar') {
        return (
          <Bar
            key={name}
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
            key={name}
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
      <ResponsiveContainer width="100%" height={320}>
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
    <div className="w-full max-w-[900px] mx-auto">
      <Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 group hover:shadow-purple-500/20 transition-smooth overflow-hidden h-[600px] flex flex-col">
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />

      <CardHeader className="space-y-3 pb-6 flex-shrink-0">
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
            {/* Settings toggle */}
            {onOpenSettings && (
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenSettings}
                className="transition-smooth"
                aria-label="Open settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}

            {/* Metrics badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs font-bold text-emerald-700">+24%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-8 flex-1 min-h-0 flex flex-col">
        <div className="relative">
          {/* Premium chart container */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50/50 to-white p-6 border border-slate-100">
            {renderChart()}
          </div>
        </div>
      </CardContent>
      </Card>
    </div>
  )
}