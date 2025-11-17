/**
 * Toast notification provider for SmartChart
 * Uses Sonner for beautiful, accessible toast notifications
 */

import { Toaster } from '@/components/ui/sonner';

export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'glass border-slate-200/60 shadow-2xl shadow-purple-500/10',
          title: 'text-sm font-semibold text-slate-900',
          description: 'text-xs text-slate-600',
          actionButton: 'bg-gradient-to-br from-purple-600 to-blue-600 text-white',
          cancelButton: 'bg-slate-100 text-slate-900',
          error: 'border-red-200/60 shadow-red-500/10',
          success: 'border-emerald-200/60 shadow-emerald-500/10',
          warning: 'border-amber-200/60 shadow-amber-500/10',
          info: 'border-blue-200/60 shadow-blue-500/10'
        }
      }}
      richColors
    />
  );
}
