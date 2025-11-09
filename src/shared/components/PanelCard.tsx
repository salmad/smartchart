import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PanelCardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  headerActions?: ReactNode
  showGradientBar?: boolean
}

export function PanelCard({
  title,
  subtitle,
  children,
  className,
  headerActions,
  showGradientBar = true,
}: PanelCardProps) {
  return (
    <Card
      className={cn(
        'glass border-slate-200/60 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-smooth h-full flex flex-col',
        className
      )}
    >
      {showGradientBar && (
        <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
      )}

      {title && (
        <CardHeader className="space-y-3 pb-6 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {title}
              </CardTitle>
              {subtitle && (
                <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
              </div>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={cn('flex-1 min-h-0', !title && 'pt-6')}>
        {children}
      </CardContent>
    </Card>
  )
}
