import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Upload, Sparkles, Check, Wand2, X } from 'lucide-react'
import { extractChartFromImage } from '../services/geminiExtraction'
import { transformToChartConfig } from '../services/dataTransformer'
import { ChartRenderer } from '@/features/chart/components/ChartRenderer'
import type { MakeoverState } from '../types'
import type { ChartConfig } from '@/app/providers/ChartConfigProvider'

interface MakeoverPanelProps {
  onClose: () => void
}

export function MakeoverPanel({ onClose }: MakeoverPanelProps) {
  const [state, setState] = useState<MakeoverState>({
    status: 'idle',
    originalImage: null,
    extractedData: null,
    error: null
  })
  const [transformedConfig, setTransformedConfig] = useState<ChartConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault()

    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          await processImage(file)
        }
        return
      }
    }

    // No image found in clipboard
    setState(prev => ({
      ...prev,
      error: 'No image found in clipboard. Please copy an image first.'
    }))
  }

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await processImage(file)
    }
  }

  // Process the image
  const processImage = async (file: File) => {
    // Reset state
    setState({
      status: 'processing',
      originalImage: URL.createObjectURL(file),
      extractedData: null,
      error: null
    })

    try {
      // Extract chart data using Gemini Vision
      const extractedData = await extractChartFromImage(file)

      // Transform to ChartConfig
      const config = transformToChartConfig(extractedData)

      setState(prev => ({
        ...prev,
        status: 'complete',
        extractedData
      }))
      setTransformedConfig(config)
    } catch (error) {
      console.error('Chart extraction failed:', error)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to process image'
      }))
    }
  }

  // Reset and start over
  const handleReset = () => {
    setState({
      status: 'idle',
      originalImage: null,
      extractedData: null,
      error: null
    })
    setTransformedConfig(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const improvements = [
    'Applied premium color palette',
    'Improved spacing and typography',
    'Added gradient accents',
    'Enhanced readability',
    'Added glass morphism effects',
    'Optimized for presentations'
  ]

  return (
    <div className="min-h-screen gradient-mesh p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
              Chart Makeover
            </h1>
            <p className="text-slate-600">
              Transform your ugly Excel chart into a work of art in 3 seconds
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            className="h-10 w-10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Idle State - Upload Zone */}
        {state.status === 'idle' && (
          <Card className="glass border-2 border-dashed border-purple-300 rounded-2xl">
            <CardContent
              className="p-16 text-center cursor-pointer"
              onPaste={handlePaste}
              tabIndex={0}
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-12 h-12 text-purple-600" />
              </div>

              <h3 className="text-2xl font-bold mb-3 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Paste your chart screenshot here
              </h3>

              <p className="text-slate-600 mb-6">
                Press <kbd className="px-2 py-1 bg-slate-200 rounded text-sm font-mono">Ctrl+V</kbd> to paste from clipboard
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-br from-purple-600 to-blue-600"
              >
                Or Browse Files
              </Button>

              <p className="text-sm text-slate-500 mt-6">
                Supports: PNG, JPG, chart screenshots
              </p>
            </CardContent>
          </Card>
        )}

        {/* Processing State */}
        {state.status === 'processing' && (
          <Card className="glass">
            <CardContent className="p-12 text-center">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 animate-pulse">
                  <Sparkles className="w-full h-full text-purple-600" />
                </div>
              </div>

              <h3 className="text-xl font-bold mb-4">Transforming your chart...</h3>

              <div className="space-y-2 max-w-md mx-auto text-left">
                <ProcessStep done text="Detecting chart type..." />
                <ProcessStep done text="Extracting data points..." />
                <ProcessStep text="Applying premium design..." />
              </div>

              <div className="mt-6 w-64 mx-auto h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500 animate-pulse"
                  style={{ width: '66%' }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <Card className="glass border-red-300">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Extraction Failed</h3>
              <p className="text-slate-600 mb-6">{state.error}</p>
              <Button onClick={handleReset}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        {/* Complete State - Before/After */}
        {state.status === 'complete' && state.originalImage && transformedConfig && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              {/* BEFORE */}
              <Card className="border-2 border-slate-300 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <CardTitle className="text-lg">Before</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white p-4">
                    <img
                      src={state.originalImage}
                      alt="Original chart"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AFTER */}
              <Card className="glass border-purple-300 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
                {/* Gradient accent bar */}
                <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                    <CardTitle className="text-lg">After</CardTitle>
                    <Sparkles className="w-4 h-4 text-purple-600 ml-auto" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl bg-gradient-to-br from-slate-50/50 to-white p-6 border border-slate-100">
                    <ChartRenderer config={transformedConfig} onSeriesToggle={() => {}} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Improvements Summary */}
            <Card className="glass">
              <CardContent className="pt-6">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  We fixed {improvements.length} design issues:
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {improvements.map((improvement, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{improvement}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
              >
                Try Another Chart
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProcessStep({ done, text }: { done?: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <Check className="w-4 h-4 text-emerald-600" />
      ) : (
        <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      )}
      <span className="text-sm text-slate-700">{text}</span>
    </div>
  )
}
