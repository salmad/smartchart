# Migration Guide: Refactored Architecture

This guide helps you complete the migration to the new refactored architecture.

## Current Status

✅ **Completed:**
- New folder structure created
- Context providers implemented
- Custom hooks created
- Feature modules refactored
- Shared components extracted
- Service layer abstracted
- App.tsx refactored and activated
- High-level guidelines documented

## What's Working

The app is currently running with the new architecture:
- **Port:** http://localhost:5174 (or check terminal)
- **Chart rendering** via Context API
- **Chat functionality** using custom hooks
- **Settings panel** with context integration
- **Premium design** maintained throughout

## Remaining Tasks

### 1. Update CommandPalette (Optional)

The CommandPalette still uses old callback props. To fully modernize:

**Current location:** `src/components/CommandPalette.tsx`

**Update to:**
```tsx
import { useChartConfig } from '@/app/providers/ChartConfigProvider'

export function CommandPalette() {
  const { setChartType, toggleDataLabels } = useChartConfig()

  // Remove props, use context directly
}
```

**Then move to:** `src/shared/components/CommandPalette.tsx`

### 2. Update ChartExportDialog (Optional)

**Current location:** `src/components/ChartExportDialog.tsx`

**Move to:** `src/features/chart/components/ChartExportDialog.tsx`

**Update to use context:**
```tsx
import { useChartConfig } from '@/app/providers/ChartConfigProvider'

export function ChartExportDialog() {
  const { config } = useChartConfig()
  // Use config from context instead of props
}
```

### 3. Clean Up Old Files (After Testing)

Once you've confirmed everything works:

```bash
# Remove old deprecated components
rm src/components/ChartPanel.tsx
rm src/components/ChatPanel.tsx
rm src/components/SettingsPanel.tsx
rm src/App.old.tsx

# Remove old lib files (now in services)
rm src/lib/gemini.ts

# Keep these old folders for now (contain shadcn components):
# - src/components/ui/
# - src/lib/utils.ts
# - src/types/chart.ts (will be deprecated after moving to shared)
# - src/utils/animations.ts (will be deprecated after moving to shared)
```

### 4. Update Import Paths

Some components may still import from old locations. Update these gradually:

**Old:**
```tsx
import { ChartPanel } from './components/ChartPanel'
import { ChatPanel } from './components/ChatPanel'
import { SettingsPanel } from './components/SettingsPanel'
import type { ChartConfiguration } from '@/types/chart'
import { modifyChart } from '@/lib/gemini'
```

**New:**
```tsx
import { ChartPanel } from '@/features/chart'
import { ChatPanel } from '@/features/chat'
import { SettingsPanel } from '@/features/settings'
import type { ChartConfiguration } from '@/shared/types/chart'
import { geminiService } from '@/services/ai'
```

### 5. Install Missing Type Definitions

Fix TypeScript warnings:

```bash
npm install --save-dev @types/canvas-confetti
```

### 6. Test Checklist

Verify all functionality works:

- [ ] **Chart Panel**
  - [ ] Chart renders correctly
  - [ ] Title/subtitle editing works
  - [ ] Settings button opens settings panel
  - [ ] Legend click toggles series visibility
  - [ ] Metrics badge displays

- [ ] **Chat Panel**
  - [ ] Opens/closes correctly
  - [ ] Sends messages to Gemini API
  - [ ] Updates chart based on responses
  - [ ] Error handling works
  - [ ] Retry button works on errors
  - [ ] Feedback buttons work
  - [ ] Suggested prompts clickable
  - [ ] Keyboard shortcut (Cmd+Shift+K) works

- [ ] **Settings Panel**
  - [ ] Opens/closes correctly
  - [ ] Chart type changes work (Bar/Line/Combined)
  - [ ] Series type changes work (Combined mode)
  - [ ] Data labels toggle works
  - [ ] Color palette changes apply
  - [ ] Palette preview displays correctly

- [ ] **Panels**
  - [ ] Only one panel open at a time
  - [ ] Smooth animations
  - [ ] Mobile responsive (backdrop, overlays)
  - [ ] Floating buttons appear when panels closed

- [ ] **Command Palette**
  - [ ] Opens with Cmd+K / Ctrl+K
  - [ ] Chart type commands work
  - [ ] Data label toggle works

- [ ] **Keyboard Shortcuts**
  - [ ] Cmd+K / Ctrl+K for command palette
  - [ ] Cmd+Shift+K / Ctrl+Shift+K for chat toggle

- [ ] **Premium Design**
  - [ ] Glass effect intact
  - [ ] Gradient bars on cards
  - [ ] Colored shadows
  - [ ] Smooth transitions
  - [ ] Typography styled correctly

## How to Use New Architecture

### Adding a New Feature

1. Create feature folder:
```bash
mkdir -p src/features/analytics/{components,hooks,utils}
```

2. Create feature components:
```tsx
// src/features/analytics/components/AnalyticsPanel.tsx
import { useChartConfig } from '@/app/providers/ChartConfigProvider'

export function AnalyticsPanel() {
  const { config } = useChartConfig()
  // Feature implementation
}
```

3. Export from feature index:
```tsx
// src/features/analytics/index.ts
export { AnalyticsPanel } from './components/AnalyticsPanel'
export { useAnalytics } from './hooks/useAnalytics'
```

4. Use in App:
```tsx
import { AnalyticsPanel } from '@/features/analytics'
```

### Creating Shared Components

1. Add to shared folder:
```bash
touch src/shared/components/DataGrid.tsx
```

2. Follow PanelCard pattern for consistency:
```tsx
import { cn } from '@/shared/lib/utils'

export function DataGrid({ className, ...props }) {
  return <div className={cn('glass shadow-2xl', className)} {...props} />
}
```

### Adding Custom Hooks

1. Create in shared hooks:
```bash
touch src/shared/hooks/useDataFetch.ts
```

2. Export reusable logic:
```tsx
export function useDataFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch logic
  }, [url])

  return { data, loading }
}
```

### Creating New Contexts

1. Add to app/providers:
```bash
touch src/app/providers/ThemeProvider.tsx
```

2. Follow existing pattern:
```tsx
import { createContext, useContext, useState, useMemo } from 'react'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

3. Add to AppProviders:
```tsx
// src/app/providers/AppProviders.tsx
import { ThemeProvider } from './ThemeProvider'

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ChartConfigProvider>
        <UIStateProvider>
          {children}
        </UIStateProvider>
      </ChartConfigProvider>
    </ThemeProvider>
  )
}
```

## Benefits You Now Have

### 1. **Scalability**
- Easy to add new pages/routes
- Feature folders keep related code together
- Shared components reduce duplication

### 2. **Maintainability**
- Clear separation of concerns
- Context prevents prop drilling
- Hooks extract reusable logic
- Type safety throughout

### 3. **Testability**
- Pure functions in utils
- Isolated hooks
- Mockable services
- Components with clear boundaries

### 4. **Developer Experience**
- Easy to find code
- Self-documenting structure
- Clear patterns to follow
- Comprehensive guidelines

## Troubleshooting

### Build Errors

**Error:** `Cannot find module '@/features/chart'`
- Check tsconfig.json has `"@/*": ["./src/*"]` in paths
- Restart TypeScript server in VS Code (Cmd+Shift+P > "Restart TS Server")

**Error:** `useChartConfig must be used within ChartConfigProvider`
- Ensure component is wrapped in `<AppProviders>`
- Check App.tsx has providers correctly composed

**Error:** `Module not found: '@/shared/types/chart'`
- Verify file exists at `src/shared/types/chart.ts`
- Check file has proper exports

### Runtime Errors

**Chart not rendering:**
- Check browser console for errors
- Verify Context providers are wrapping App
- Ensure chart data structure matches types

**Chat not working:**
- Check VITE_GEMINI_API_KEY in .env
- Verify geminiService is properly exported
- Check network tab for API calls

**Settings not applying:**
- Verify context methods are being called
- Check state updates in React DevTools
- Ensure config structure matches types

## Next Steps

1. **Test thoroughly** - Use checklist above
2. **Update documentation** - Update README with new structure
3. **Add more features** - Follow patterns established
4. **Consider routing** - React Router for multi-page app
5. **Add testing** - Vitest + React Testing Library

## Resources

- **ARCHITECTURE.md** - Best practices and patterns
- **REFACTORING_SUMMARY.md** - What changed and why
- **React Context Docs** - https://react.dev/learn/passing-data-deeply-with-context
- **Custom Hooks Guide** - https://react.dev/learn/reusing-logic-with-custom-hooks

---

**Questions?** Review ARCHITECTURE.md for detailed guidelines and patterns.
