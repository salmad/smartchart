/**
 * Dialog component for viewing McKinsey-style slides
 * Opens in a large modal to display the slide presentation
 */

import { Dialog, DialogContent } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { X, Download, Presentation } from 'lucide-react'
import { SlidePresentation } from './SlidePresentation'
import type { ChartConfiguration } from '@/shared/types/chart'
import type { SlideContent } from '../utils/slideGenerator'

interface SlideDialogProps {
  isOpen: boolean
  onClose: () => void
  config: ChartConfiguration
  slideContent: SlideContent
}

export function SlideDialog({ isOpen, onClose, config, slideContent }: SlideDialogProps) {
  const handleDownload = () => {
    // TODO: Implement slide download as PNG/PDF
    console.log('Download slide functionality coming soon!')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                McKinsey-Style Slide
              </h2>
              <p className="text-sm text-gray-500">
                Professional consulting presentation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Slide Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div className="mx-auto bg-white shadow-2xl" style={{ aspectRatio: '16/9', maxHeight: 'calc(90vh - 120px)' }}>
            <SlidePresentation config={config} slideContent={slideContent} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
