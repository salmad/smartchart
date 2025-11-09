/**
 * Command Palette (Cmd+K) for SmartChart
 * Quick access to all features with keyboard shortcuts
 */

import { useEffect, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import {
  BarChart3,
  LineChart,
  Download,
  Palette,
  MessageSquare,
  Sparkles,
  FileText,
  Settings,
  Zap,
  TrendingUp
} from 'lucide-react';

interface CommandPaletteProps {
  onChangeChartType?: (type: 'bar' | 'line' | 'combined') => void;
  onExportChart?: () => void;
  onChangePalette?: () => void;
  onClearChat?: () => void;
  onToggleDataLabels?: () => void;
}

export function CommandPalette({
  onChangeChartType,
  onExportChart,
  onChangePalette,
  onClearChat,
  onToggleDataLabels
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." className="text-sm" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Chart Actions">
          {onChangeChartType && (
            <>
              <CommandItem onSelect={() => handleAction(() => onChangeChartType('bar'))}>
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Switch to Bar Chart</span>
                <kbd className="ml-auto text-xs text-slate-500">B</kbd>
              </CommandItem>
              <CommandItem onSelect={() => handleAction(() => onChangeChartType('line'))}>
                <LineChart className="mr-2 h-4 w-4" />
                <span>Switch to Line Chart</span>
                <kbd className="ml-auto text-xs text-slate-500">L</kbd>
              </CommandItem>
              <CommandItem onSelect={() => handleAction(() => onChangeChartType('combined'))}>
                <TrendingUp className="mr-2 h-4 w-4" />
                <span>Switch to Combined Chart</span>
                <kbd className="ml-auto text-xs text-slate-500">C</kbd>
              </CommandItem>
            </>
          )}
          {onToggleDataLabels && (
            <CommandItem onSelect={() => handleAction(onToggleDataLabels)}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Toggle Data Labels</span>
              <kbd className="ml-auto text-xs text-slate-500">D</kbd>
            </CommandItem>
          )}
          {onExportChart && (
            <CommandItem onSelect={() => handleAction(onExportChart)}>
              <Download className="mr-2 h-4 w-4" />
              <span>Export Chart</span>
              <kbd className="ml-auto text-xs text-slate-500">⌘E</kbd>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          {onChangePalette && (
            <CommandItem onSelect={() => handleAction(onChangePalette)}>
              <Palette className="mr-2 h-4 w-4" />
              <span>Change Color Palette</span>
              <kbd className="ml-auto text-xs text-slate-500">P</kbd>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Chat">
          {onClearChat && (
            <CommandItem onSelect={() => handleAction(onClearChat)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Clear Chat History</span>
              <kbd className="ml-auto text-xs text-slate-500">⌘⌫</kbd>
            </CommandItem>
          )}
          <CommandItem>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Suggest Improvements</span>
            <kbd className="ml-auto text-xs text-slate-500">S</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Preferences</span>
          </CommandItem>
          <CommandItem>
            <Zap className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
            <kbd className="ml-auto text-xs text-slate-500">?</kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
