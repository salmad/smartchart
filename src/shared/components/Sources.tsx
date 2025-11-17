import { ExternalLink } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { WebSource } from '@/services/ai'

interface SourcesProps {
  sources: WebSource[]
}

export function Sources({ sources }: SourcesProps) {
  if (!sources || sources.length === 0) {
    return null
  }

  return (
    <div className="mt-6 pt-4 border-t border-slate-200">
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Sources:
        </span>
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border border-purple-200/50 hover:border-purple-300 transition-all text-xs font-medium text-purple-700 hover:text-purple-900 shadow-sm hover:shadow-md"
                  >
                    <span className="max-w-[200px] truncate">{source.title}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </TooltipTrigger>
                {source.description && (
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">{source.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  )
}
