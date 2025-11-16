import { useState } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Settings, Presentation } from 'lucide-react'
import { PanelCard } from '@/shared/components/PanelCard'
import { ChartRenderer } from './ChartRenderer'
import { useChartConfig } from '@/app/providers/ChartConfigProvider'
import { SlideDialog, generateSlideContent } from '@/features/slides'

interface ChartPanelProps {
  onOpenSettings?: () => void
}

export function ChartPanel({ onOpenSettings }: ChartPanelProps) {
  const { config, setTitle, setSubtitle, setDataDescription, toggleSeries } = useChartConfig()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isSlideOpen, setIsSlideOpen] = useState(false)

  const { title, subtitle } = config.styling
  const { description } = config.data

  const handleGenerateSlide = () => {
    setIsSlideOpen(true)
  }

  const slideContent = generateSlideContent(config)

  return (
    <div className="w-full max-w-[900px] mx-auto">
      <PanelCard
        className="overflow-hidden h-[600px]"
        showGradientBar
      >
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
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                    className="text-3xl font-bold h-12"
                    autoFocus
                  />
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="text-sm"
                    placeholder="Subtitle"
                  />
                </div>
              ) : (
                <div onClick={() => setIsEditingTitle(true)} className="cursor-pointer">
                  <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent hover:opacity-70 transition-smooth">
                    {title}
                  </CardTitle>
                  <p className="text-sm text-slate-500 font-medium hover:text-slate-700 transition-smooth">
                    {subtitle}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSlide}
                className="gap-2 transition-smooth"
                aria-label="Generate slide"
              >
                <Presentation className="w-4 h-4" />
                <span className="hidden sm:inline">Generate Slide</span>
              </Button>

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

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
                <svg
                  className="w-3.5 h-3.5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span className="text-xs font-bold text-emerald-700">+24%</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-8 flex-1 min-h-0 flex flex-col gap-6">
          <div className="relative flex-1 min-h-0">
            <div className="rounded-xl bg-gradient-to-br from-slate-50/50 to-white p-6 border border-slate-100 h-full">
              <ChartRenderer config={config} onSeriesToggle={toggleSeries} />
            </div>
          </div>

          {/* Data Description */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-600">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                DATA CONTEXT
              </div>
            </div>
            <textarea
              value={description || ''}
              onChange={(e) => setDataDescription(e.target.value)}
              placeholder="Describe your data: What is it? Where does it come from? What do you want to understand from it?"
              className="w-full px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-smooth resize-none"
              rows={3}
            />
            <p className="text-xs text-slate-400 mt-2">
              This helps Claude generate better insights and slide recommendations
            </p>
          </div>
        </CardContent>
      </PanelCard>

      {/* Slide Dialog */}
      <SlideDialog
        isOpen={isSlideOpen}
        onClose={() => setIsSlideOpen(false)}
        config={config}
        slideContent={slideContent}
      />
    </div>
  )
}
