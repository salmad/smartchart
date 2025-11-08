import { useState } from 'react'
import { ChartPanel } from './components/ChartPanel'
import { ChatPanel } from './components/ChatPanel'
import type { ChartConfiguration } from '@/types/chart'

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

function App() {
  const [chartConfig, setChartConfig] = useState<ChartConfiguration>(initialConfig)

  return (
    <div className="min-h-screen gradient-mesh relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-grid-slate-100/[0.02] bg-[size:75px_75px]" />

      <div className="relative container mx-auto px-6 py-12 max-w-[1600px]">
        {/* Premium Header */}
        <div className="mb-16 text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Powered by AI
            </span>
          </div>

          <h1 className="text-7xl md:text-8xl font-bold tracking-tighter">
            <span className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
              SmartChart
            </span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">
            Transform data into stunning visualizations with natural language.
            <br />
            <span className="text-slate-500 text-lg">Simple, powerful, beautiful.</span>
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <ChartPanel config={chartConfig} onConfigChange={setChartConfig} />
          <ChatPanel currentConfig={chartConfig} onConfigChange={setChartConfig} />
        </div>
        
        {/* Footer badge */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>Built with precision and care</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App