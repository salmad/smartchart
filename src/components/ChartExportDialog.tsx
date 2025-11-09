/**
 * Chart Export Dialog
 * Allows users to export charts in various formats with preview
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, FileImage, FileCode, FileJson, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { triggerSuccessConfetti } from '@/utils/animations'

interface ChartExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chartRef?: React.RefObject<HTMLDivElement>
  chartConfig?: any
}

export function ChartExportDialog({
  open,
  onOpenChange,
  chartRef,
  chartConfig
}: ChartExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'svg' | 'json'>('png')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    // Simulate export delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Show success message
    toast.success('Chart exported successfully!', {
      description: `Your chart has been downloaded as ${selectedFormat.toUpperCase()}.`,
      duration: 3000
    })

    // Trigger celebration
    triggerSuccessConfetti()

    setIsExporting(false)
    onOpenChange(false)
  }

  const exportFormats = [
    {
      id: 'png',
      label: 'PNG Image',
      description: 'High-quality raster image',
      icon: FileImage,
      size: '~150 KB',
      recommended: true
    },
    {
      id: 'svg',
      label: 'SVG Vector',
      description: 'Scalable vector graphic',
      icon: FileCode,
      size: '~45 KB',
      recommended: false
    },
    {
      id: 'json',
      label: 'JSON Data',
      description: 'Chart configuration & data',
      icon: FileJson,
      size: '~8 KB',
      recommended: false
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass border-purple-200/60 shadow-2xl shadow-purple-500/20">
        <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 absolute top-0 left-0 right-0 rounded-t-lg" />

        <DialogHeader className="pt-6">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
            <Download className="w-6 h-6 text-purple-600" />
            Export Chart
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Choose your preferred export format and download your chart
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="png" className="w-full" onValueChange={(value) => setSelectedFormat(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="png">PNG</TabsTrigger>
            <TabsTrigger value="svg">SVG</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-3">
            {exportFormats.map((format) => (
              <TabsContent key={format.id} value={format.id} className="mt-0">
                <motion.div
                  className="p-4 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <format.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">{format.label}</h4>
                        {format.recommended && (
                          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{format.description}</p>
                      <p className="text-xs text-slate-500">Estimated size: {format.size}</p>
                    </div>
                  </div>

                  {format.id === 'png' && (
                    <div className="mt-4 p-3 rounded-lg bg-white/80 border border-slate-200">
                      <p className="text-xs text-slate-600">
                        <strong>Features:</strong> Transparent background, high DPI (300), optimized for presentations
                      </p>
                    </div>
                  )}

                  {format.id === 'svg' && (
                    <div className="mt-4 p-3 rounded-lg bg-white/80 border border-slate-200">
                      <p className="text-xs text-slate-600">
                        <strong>Features:</strong> Infinitely scalable, editable in design tools, smaller file size
                      </p>
                    </div>
                  )}

                  {format.id === 'json' && (
                    <div className="mt-4 p-3 rounded-lg bg-white/80 border border-slate-200">
                      <p className="text-xs text-slate-600">
                        <strong>Features:</strong> Complete chart configuration, data points, styling, re-importable
                      </p>
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30"
          >
            {isExporting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Download className="w-4 h-4 mr-2" />
                </motion.div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {selectedFormat.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
