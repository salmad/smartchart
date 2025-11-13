import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import type { ChartConfiguration } from '@/shared/types/chart'

interface ChartRendererProps {
  config: ChartConfiguration
  onSeriesToggle: (seriesName: string) => void
}

export function ChartRenderer({ config, onSeriesToggle }: ChartRendererProps) {
  const { data, styling } = config
  const { dataPoints, xAxisKey, seriesNames } = data
  const { chartType, seriesTypes, seriesColors, hiddenSeries, showDataLabels } = styling

  const handleLegendClick = (data: any) => {
    if (data && data.dataKey) {
      onSeriesToggle(data.dataKey)
    }
  }

  const commonProps = {
    data: dataPoints,
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
  }

  const renderGradients = () => (
    <defs>
      {seriesColors.map((color) => (
        <linearGradient key={color.gradient} id={color.gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color.solid} stopOpacity={0.9} />
          <stop offset="95%" stopColor={color.solid} stopOpacity={0.7} />
        </linearGradient>
      ))}
    </defs>
  )

  const renderSeries = () =>
    seriesNames.map((name, idx) => {
      const isHidden = hiddenSeries.includes(name)
      const color = seriesColors[idx]
      const type = chartType === 'combined' ? seriesTypes[name] : chartType
      const fillColor = type === 'bar' ? `url(#${color.gradient})` : 'none'
      const strokeColor = color.solid

      const commonSeriesProps = {
        dataKey: name,
        strokeWidth: 2,
        hide: isHidden,
      }

      if (type === 'bar') {
        return (
          <Bar key={name} {...commonSeriesProps} fill={fillColor} radius={[8, 8, 0, 0]}>
            {showDataLabels && !isHidden && (
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
            {showDataLabels && !isHidden && (
              <LabelList
                position="top"
                style={{ fontSize: '11px', fontWeight: 600, fill: '#64748b' }}
              />
            )}
          </Line>
        )
      }
    })

  const ChartComponent = chartType === 'combined' ? ComposedChart : chartType === 'line' ? LineChart : BarChart

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ChartComponent {...commonProps}>
        {renderGradients()}
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false} />
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
            <span style={{ opacity: hiddenSeries.includes(value) ? 0.3 : 1 }}>{value}</span>
          )}
        />
        {renderSeries()}
      </ChartComponent>
    </ResponsiveContainer>
  )
}
