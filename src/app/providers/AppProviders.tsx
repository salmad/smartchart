import { type ReactNode } from 'react'
import { ChartConfigProvider } from './ChartConfigProvider'
import { UIStateProvider } from './UIStateProvider'
import { ToasterProvider } from '@/shared/components/ToasterProvider'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ChartConfigProvider>
      <UIStateProvider>
        {children}
        <ToasterProvider />
      </UIStateProvider>
    </ChartConfigProvider>
  )
}
