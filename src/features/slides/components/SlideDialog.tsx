/**
 * Dialog component for viewing McKinsey-style slides
 * Opens in a large modal to display the slide presentation
 */

import { useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { X, Download, Presentation, FileImage, FileText, Loader2 } from 'lucide-react'
import { SlidePresentation } from './SlidePresentation'
import type { ChartConfiguration } from '@/shared/types/chart'
import type { SlideContent } from '../utils/slideGenerator'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'

interface SlideDialogProps {
  isOpen: boolean
  onClose: () => void
  config: ChartConfiguration
  slideContent: SlideContent
}

export function SlideDialog({ isOpen, onClose, config, slideContent }: SlideDialogProps) {
  const slideRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleDownloadPNG = async () => {
    if (!slideRef.current) return

    try {
      setIsExporting(true)
      toast.info('Generating PNG...')

      // Capture the slide
      const canvas = await html2canvas(slideRef.current, {
        scale: 2, // Higher quality
        backgroundColor: null,
        logging: false,
        useCORS: true,
      })

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${slideContent.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          toast.success('Slide downloaded as PNG!')
        }
        setIsExporting(false)
      })
    } catch (error) {
      console.error('Error generating PNG:', error)
      toast.error('Failed to generate PNG')
      setIsExporting(false)
    }
  }

  const handlePrintPDF = () => {
    toast.info('Opening print dialog...')
    // Use browser's print functionality
    window.print()
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? 'Exporting...' : 'Download'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPNG} disabled={isExporting}>
                  <FileImage className="w-4 h-4 mr-2" />
                  Download as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrintPDF} disabled={isExporting}>
                  <FileText className="w-4 h-4 mr-2" />
                  Print as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
          <div
            ref={slideRef}
            className="mx-auto bg-white shadow-2xl"
            style={{ aspectRatio: '16/9', maxHeight: 'calc(90vh - 120px)' }}
          >
            <SlidePresentation config={config} slideContent={slideContent} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
