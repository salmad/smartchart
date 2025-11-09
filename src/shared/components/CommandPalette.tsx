/**
 * Command Palette (Cmd+K) for SmartChart
 * Quick access to all features with keyboard shortcuts
 */

import { useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/components/ui/command'
import {
  BarChart3,
  LineChart,
  Palette,
  MessageSquare,
  Sparkles,
  FileText,
  Settings,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { useChartConfig } from '@/app/providers/ChartConfigProvider'
import { useUIState } from '@/app/providers/UIStateProvider'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setChartType, toggleDataLabels } = useChartConfig()
  const { openSettings, openChat } = useUIState()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." className="text-sm" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Chart Actions">
          <CommandItem onSelect={() => handleAction(() => setChartType('bar'))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Switch to Bar Chart</span>
            <kbd className="ml-auto text-xs text-slate-500">B</kbd>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => setChartType('line'))}>
            <LineChart className="mr-2 h-4 w-4" />
            <span>Switch to Line Chart</span>
            <kbd className="ml-auto text-xs text-slate-500">L</kbd>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => setChartType('combined'))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Switch to Combined Chart</span>
            <kbd className="ml-auto text-xs text-slate-500">C</kbd>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(toggleDataLabels)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Toggle Data Labels</span>
            <kbd className="ml-auto text-xs text-slate-500">D</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Panels">
          <CommandItem onSelect={() => handleAction(openSettings)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Open Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(openChat)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Open AI Chat</span>
            <kbd className="ml-auto text-xs text-slate-500">⌘⇧K</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => handleAction(openSettings)}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Change Color Palette</span>
            <kbd className="ml-auto text-xs text-slate-500">P</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>View Keyboard Shortcuts</span>
            <kbd className="ml-auto text-xs text-slate-500">?</kbd>
          </CommandItem>
          <CommandItem>
            <Zap className="mr-2 h-4 w-4" />
            <span>Quick Start Guide</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
