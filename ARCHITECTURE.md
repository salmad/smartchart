# Architecture Guidelines

This document defines the architectural principles and patterns for SmartChart. These guidelines ensure maintainability, scalability, and code quality as the application grows into a multi-page React application.

## Core Principles

### 1. Separation of Concerns

**Principle:** Each module should have a single, well-defined responsibility.

**In Practice:**
- **Presentation Layer** - Components focus on rendering UI and handling user interactions
- **Business Logic Layer** - Custom hooks manage state, side effects, and domain logic
- **Data Layer** - Services handle external integrations (APIs, storage)
- **Type Layer** - TypeScript types define contracts between layers

**Anti-patterns to avoid:**
- ❌ Components making direct API calls
- ❌ Business logic mixed with JSX
- ❌ State management in presentation components
- ❌ Inline data transformations in render methods

**Examples:**
```tsx
// ❌ BAD: Component doing too much
function ChartPanel() {
  const [data, setData] = useState([])

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => setData(transformData(data)))
  }, [])

  return <div>{/* Complex chart rendering */}</div>
}

// ✅ GOOD: Separated concerns
function ChartPanel() {
  const { data } = useChartData() // Hook handles data fetching
  return <ChartRenderer data={data} /> // Component just renders
}
```

---

### 2. Component Reusability

**Principle:** Components should be composable, configurable, and context-independent.

**Strategies:**

**A. Compound Components Pattern**
For complex UI with multiple related sub-components:

```tsx
// Flexible, composable API
<Panel>
  <Panel.Header>
    <Panel.Title>Chart</Panel.Title>
    <Panel.Actions>
      <Button>Export</Button>
    </Panel.Actions>
  </Panel.Header>
  <Panel.Content>
    {/* Content */}
  </Panel.Content>
</Panel>
```

**B. Render Props / Children Functions**
For customizable rendering logic:

```tsx
<DataTable
  data={users}
  renderRow={(user) => <UserRow user={user} />}
  renderEmpty={() => <EmptyState />}
/>
```

**C. Composition over Configuration**
Prefer composing small components over large configurable ones:

```tsx
// ❌ BAD: Too many props
<Chart
  showLegend
  showGrid
  showTooltip
  showDataLabels
  legendPosition="top"
  gridStyle="dashed"
/>

// ✅ GOOD: Composition
<Chart>
  <Chart.Legend position="top" />
  <Chart.Grid style="dashed" />
  <Chart.Tooltip />
  <Chart.DataLabels />
</Chart>
```

**Guidelines for Reusable Components:**
- Accept minimal required props, use children for flexibility
- Avoid coupling to specific data structures or business logic
- Support common use cases without over-engineering
- Use TypeScript generics for type-safe reusability
- Document component API and usage examples

---

### 3. State Management

**Principle:** State should live at the appropriate level with a single source of truth.

**State Hierarchy:**

```
1. Local State (useState)
   ↓ When to use: UI-only state (form inputs, toggles, local modals)

2. Shared State (Context API)
   ↓ When to use: Cross-component state (theme, auth, global config)

3. Server State (React Query / SWR)
   ↓ When to use: Data from external sources (APIs, databases)

4. URL State (React Router)
   ↓ When to use: Navigation state, filters, pagination
```

**Decision Tree:**

```
Is state needed by multiple unrelated components?
  YES → Context API
  NO → Local State

Is state derived from server data?
  YES → Server state library or custom hook
  NO → Local/Context based on scope

Should state persist across page refreshes?
  YES → localStorage + Context
  NO → Context or Local State

Should state be shareable via URL?
  YES → URL State (query params)
  NO → Other state methods
```

**Context API Best Practices:**

```tsx
// ✅ GOOD: Separate contexts by concern
// ChartConfigContext - Chart data and styling
// UIStateContext - Panel visibility, shortcuts
// UserContext - Authentication state

// ✅ GOOD: Provide hook wrappers
export function useChartConfig() {
  const context = useContext(ChartConfigContext)
  if (!context) {
    throw new Error('useChartConfig must be used within ChartConfigProvider')
  }
  return context
}

// ✅ GOOD: Memoize context values
function ChartConfigProvider({ children }) {
  const [config, setConfig] = useState(initialConfig)

  const value = useMemo(
    () => ({
      config,
      updateConfig: setConfig,
      updateStyling: (updates) => setConfig(prev => ({
        ...prev,
        styling: { ...prev.styling, ...updates }
      }))
    }),
    [config]
  )

  return <ChartConfigContext.Provider value={value}>{children}</ChartConfigContext.Provider>
}
```

**Anti-patterns:**
- ❌ Prop drilling more than 2 levels deep
- ❌ Lifting state unnecessarily (keep it local when possible)
- ❌ Multiple sources of truth for same data
- ❌ Storing derived state (compute on render instead)

---

### 4. Custom Hooks

**Principle:** Extract reusable logic into custom hooks for testability and reuse.

**When to Create a Custom Hook:**
- Logic is used in multiple components
- Component has complex state management
- Need to encapsulate side effects (API calls, subscriptions)
- Want to share non-visual logic

**Hook Patterns:**

**A. State Management Hooks**
```tsx
// Encapsulate state + operations
export function useChartConfig() {
  const [config, setConfig] = useState<ChartConfiguration>(initialConfig)

  const updateStyling = useCallback((updates: Partial<ChartStyling>) => {
    setConfig(prev => ({
      ...prev,
      styling: { ...prev.styling, ...updates }
    }))
  }, [])

  const toggleSeries = useCallback((seriesName: string) => {
    setConfig(prev => ({
      ...prev,
      data: {
        ...prev.data,
        hiddenSeries: prev.data.hiddenSeries.has(seriesName)
          ? new Set([...prev.data.hiddenSeries].filter(s => s !== seriesName))
          : new Set([...prev.data.hiddenSeries, seriesName])
      }
    }))
  }, [])

  return { config, updateStyling, toggleSeries }
}
```

**B. Side Effect Hooks**
```tsx
// Encapsulate data fetching
export function useChatMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true)
    try {
      const response = await chatService.send(content)
      setMessages(prev => [...prev, response])
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { messages, isLoading, sendMessage }
}
```

**C. Utility Hooks**
```tsx
// Encapsulate reusable behavior
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  dependencies: any[] = []
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, ...dependencies])
}
```

**Hook Guidelines:**
- Always prefix with `use` (React convention)
- Keep hooks focused and single-purpose
- Return consistent shape (object or array, not both)
- Handle cleanup in useEffect returns
- Document dependencies clearly

---

### 5. Feature-Based Organization

**Principle:** Organize code by feature/domain, not by technical role.

**Directory Structure:**

```
src/
├── app/                       # Application-level concerns
│   ├── layout/
│   │   ├── AppLayout.tsx      # Main layout wrapper
│   │   ├── Header.tsx         # Top navigation
│   │   └── Sidebar.tsx        # Side navigation
│   ├── providers/
│   │   ├── AppProviders.tsx   # Compose all providers
│   │   ├── ChartConfigProvider.tsx
│   │   └── UIStateProvider.tsx
│   └── routes/
│       └── AppRoutes.tsx      # Route definitions
│
├── features/                  # Feature modules (vertical slices)
│   ├── chart/
│   │   ├── components/        # Chart-specific components
│   │   │   ├── ChartPanel.tsx
│   │   │   ├── ChartRenderer.tsx
│   │   │   ├── ChartHeader.tsx
│   │   │   └── ChartExportDialog.tsx
│   │   ├── hooks/             # Chart-specific hooks
│   │   │   ├── useChartConfig.ts
│   │   │   └── useChartExport.ts
│   │   ├── utils/             # Chart utilities
│   │   │   └── chart-helpers.ts
│   │   └── index.ts           # Public API
│   │
│   ├── chat/
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── Message.tsx
│   │   ├── hooks/
│   │   │   └── useChatMessages.ts
│   │   ├── services/
│   │   │   └── chatService.ts
│   │   └── index.ts
│   │
│   └── settings/
│       ├── components/
│       │   ├── SettingsPanel.tsx
│       │   └── PaletteSelector.tsx
│       ├── hooks/
│       │   └── useSettings.ts
│       └── index.ts
│
├── shared/                    # Shared across features
│   ├── components/
│   │   ├── ui/               # Base UI components (shadcn)
│   │   ├── PanelCard.tsx     # Reusable panel wrapper
│   │   ├── CloseButton.tsx   # Standard close button
│   │   └── TypingIndicator.tsx
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts
│   │   └── usePanelState.ts
│   ├── lib/
│   │   ├── utils.ts          # Utility functions
│   │   ├── palettes.ts       # Color palettes
│   │   └── animations.ts     # Animation configs
│   └── types/
│       ├── chart.ts
│       └── common.ts
│
├── services/                  # External integrations
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── storage/
│       └── localStorage.ts
│
├── App.tsx                    # Root component
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

**Benefits:**
- Easy to locate feature-related code
- Clear boundaries between features
- Easier to delete/refactor entire features
- Supports team ownership (team per feature)
- Scales better than role-based organization

**Feature Module Guidelines:**
- Each feature exports a public API via `index.ts`
- Features should not directly import from other features
- Shared code goes in `shared/`
- Services are shared infrastructure

---

### 6. Component Structure

**Principle:** Consistent component architecture improves readability and maintenance.

**Standard Component Template:**

```tsx
// 1. Imports (grouped logically)
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useChartConfig } from '@/features/chart/hooks/useChartConfig'
import type { ChartConfiguration } from '@/shared/types/chart'

// 2. Types (component-specific)
interface ChartPanelProps {
  className?: string
  onExport?: () => void
}

// 3. Component
export function ChartPanel({ className, onExport }: ChartPanelProps) {
  // 3a. Hooks (grouped by type)
  const { config, updateConfig } = useChartConfig()
  const [isEditing, setIsEditing] = useState(false)

  // 3b. Derived state
  const hasData = config.data.series.length > 0

  // 3c. Event handlers
  const handleTitleChange = useCallback((title: string) => {
    updateConfig({ ...config, title })
  }, [config, updateConfig])

  // 3d. Effects
  useEffect(() => {
    // Side effects
  }, [])

  // 3e. Render
  return (
    <div className={className}>
      {/* JSX */}
    </div>
  )
}

// 4. Sub-components (if tightly coupled)
function ChartTitle({ value, onChange }: ChartTitleProps) {
  return <input value={value} onChange={e => onChange(e.target.value)} />
}
```

**Guidelines:**
- Destructure props in function signature
- Use named exports (not default exports)
- Keep components under 200 lines (split if larger)
- Extract complex logic to hooks
- Co-locate tightly coupled sub-components

---

### 7. Type Safety

**Principle:** Leverage TypeScript for compile-time safety and developer experience.

**Best Practices:**

**A. Define Domain Types**
```typescript
// shared/types/chart.ts
export interface ChartConfiguration {
  data: ChartData
  styling: ChartStyling
  metadata: ChartMetadata
}

export interface ChartData {
  series: ChartSeries[]
  categories: string[]
  hiddenSeries: Set<string>
}

export type ChartType = 'bar' | 'line' | 'area' | 'combined'
export type SeriesType = ChartType
```

**B. Type Component Props**
```typescript
// Use interface for extensibility
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

// Use type for unions/intersections
export type IconButtonProps = ButtonProps & {
  icon: React.ReactNode
  'aria-label': string // Required for accessibility
}
```

**C. Type Hook Returns**
```typescript
export function useChartConfig(): {
  config: ChartConfiguration
  updateConfig: (config: ChartConfiguration) => void
  updateStyling: (updates: Partial<ChartStyling>) => void
  isLoading: boolean
  error: Error | null
} {
  // Implementation
}
```

**D. Avoid `any`**
```typescript
// ❌ BAD
function processData(data: any) {
  return data.map((item: any) => item.value)
}

// ✅ GOOD
function processData<T extends { value: number }>(data: T[]) {
  return data.map(item => item.value)
}
```

**Type Safety Rules:**
- Enable `strict` mode in tsconfig.json
- Never use `any` (use `unknown` if type is truly unknown)
- Define types before implementation
- Use generics for reusable type-safe code
- Prefer interfaces for object shapes

---

### 8. Testing & Maintainability

**Principle:** Write code that is easy to test and understand.

**Testability Guidelines:**

**A. Pure Functions**
Prefer pure functions for business logic (easier to test):

```typescript
// ✅ GOOD: Pure function
export function calculateChartDimensions(
  data: ChartData,
  containerWidth: number
): { width: number; height: number; margin: Margin } {
  const seriesCount = data.series.length
  const height = Math.max(400, seriesCount * 50)
  return { width: containerWidth, height, margin: { top: 20, right: 30, bottom: 40, left: 50 } }
}

// ❌ BAD: Impure (depends on external state)
function calculateDimensions() {
  const data = useChartConfig() // Can't test without React context
  return { width: window.innerWidth, height: 400 }
}
```

**B. Dependency Injection**
Pass dependencies as parameters for easier mocking:

```typescript
// ✅ GOOD: Injectable dependency
export async function fetchChartData(
  apiClient: ApiClient,
  chartId: string
): Promise<ChartData> {
  return apiClient.get(`/charts/${chartId}`)
}

// Test can inject mock apiClient
const mockApi = { get: vi.fn().mockResolvedValue(mockData) }
await fetchChartData(mockApi, 'chart-1')
```

**C. Extract Complex Logic from Components**
```tsx
// ❌ BAD: Logic in component (hard to test)
function ChartPanel() {
  const [data, setData] = useState([])

  useEffect(() => {
    const transformed = data
      .filter(d => d.value > 0)
      .map(d => ({ ...d, label: d.name.toUpperCase() }))
      .sort((a, b) => b.value - a.value)

    setTransformedData(transformed)
  }, [data])
}

// ✅ GOOD: Logic in testable function
export function transformChartData(data: RawData[]): TransformedData[] {
  return data
    .filter(d => d.value > 0)
    .map(d => ({ ...d, label: d.name.toUpperCase() }))
    .sort((a, b) => b.value - a.value)
}

function ChartPanel() {
  const [data, setData] = useState([])
  const transformed = useMemo(() => transformChartData(data), [data])
}
```

**Maintainability Guidelines:**

**A. Single Responsibility**
Each file/function should have one reason to change:

```typescript
// ❌ BAD: Multiple responsibilities
function ChartPanel() {
  // Renders UI
  // Fetches data
  // Transforms data
  // Handles user interactions
  // Manages keyboard shortcuts
}

// ✅ GOOD: Separated responsibilities
function ChartPanel() {
  const { data } = useChartData()        // Data fetching
  const transformed = useTransformData(data) // Transformation
  useChartShortcuts()                    // Keyboard handling

  return <ChartRenderer data={transformed} /> // Rendering
}
```

**B. Clear Dependencies**
Make dependencies explicit:

```typescript
// ✅ GOOD: Clear dependencies
export function formatChartLabel(
  value: number,
  formatter: (n: number) => string = defaultFormatter
): string {
  return formatter(value)
}

// Usage is clear
formatChartLabel(1234, currencyFormatter)
```

**C. Avoid Magic Numbers/Strings**
Use named constants:

```typescript
// ❌ BAD
if (chartType === 'bar' && width > 768) {
  return 400
}

// ✅ GOOD
const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  AREA: 'area'
} as const

const BREAKPOINTS = {
  TABLET: 768,
  DESKTOP: 1024
}

const DEFAULT_CHART_HEIGHT = 400

if (chartType === CHART_TYPES.BAR && width > BREAKPOINTS.TABLET) {
  return DEFAULT_CHART_HEIGHT
}
```

---

## Design System Integration

**Principle:** Maintain premium design quality through consistent patterns.

### Component Styling Rules

1. **shadcn/ui Only** - Never build UI primitives from scratch
2. **Tailwind Classes** - No inline styles
3. **Premium Patterns** - Glass effects, gradients, colored shadows
4. **Spacing** - `p-8` for cards, `gap-8` for layouts (not p-6 or gap-4)
5. **Transitions** - Always use `transition-smooth` (300ms ease-out)

See `DESIGN_SYSTEM.md` for complete specification.

---

## Migration Strategy

When refactoring existing code:

1. **Create new structure alongside old** - Don't break working code
2. **Migrate feature by feature** - Start with most isolated feature
3. **Update imports gradually** - Use path aliases (`@/features/*`)
4. **Test after each migration** - Ensure functionality preserved
5. **Delete old code only when fully replaced**

---

## Code Review Checklist

Before merging code, verify:

- [ ] Component has single responsibility
- [ ] Business logic extracted to hooks or utilities
- [ ] No prop drilling beyond 2 levels (use Context)
- [ ] Pure functions for transformations
- [ ] TypeScript strict mode compliance (no `any`)
- [ ] Components under 200 lines
- [ ] shadcn/ui components used (no custom UI primitives)
- [ ] Premium styling patterns applied
- [ ] Proper error handling
- [ ] Clear, descriptive naming
- [ ] Code organized in correct feature folder

---

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Context API Guide](https://react.dev/learn/passing-data-deeply-with-context)
- [Component Composition Patterns](https://react.dev/learn/passing-props-to-a-component)

---

**Remember:** These guidelines are principles, not rigid rules. Apply judgment based on context, but always favor simplicity, testability, and maintainability.
