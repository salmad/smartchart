# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartChart is an interactive chart creation application where users create and modify charts using natural language. The app follows premium design standards inspired by Linear, Revolut, and Canvas - aiming for "$200 Framer template" quality.

**Tech Stack:**
- React 18 + TypeScript (strict mode)
- Vite for build tooling
- shadcn/ui components with Tailwind CSS
- Recharts for data visualization
- Lucide React for icons
- Google Gemini API (planned integration for NLP)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview

# Lint code
npm run lint
```

## Environment Setup

Copy `.env.example` to `.env` and add API keys:
```bash
VITE_GEMINI_API_KEY=your_api_key_here
VITE_OPENAI_API_KEY=your_api_key_here  # Alternative NLP provider
```

## Architecture

### Component Structure

**App.tsx** - Main application component with premium landing layout, gradient mesh background, and responsive grid layout for chart + chat panels.

**ChartPanel.tsx** - Interactive chart visualization:
- Manages chart state (type, series visibility, data labels, titles)
- Renders bar/line/combined charts with Recharts
- Includes editable titles and collapsible controls panel
- Click legend items to toggle series visibility
- Premium styling with gradients, glass morphism, colored shadows

**ChatPanel.tsx** - AI chat interface:
- Message history with user/assistant roles
- Empty state with suggested prompts
- Quick action buttons
- Placeholder for Gemini API integration (currently mock responses)

**components/ui/** - shadcn/ui base components (Button, Card, Input, ScrollArea)

### State Management

Currently uses local component state (`useState`). No global state management library.

Chart state in `ChartPanel`:
- `chartType`: 'bar' | 'line' | 'combined'
- `seriesTypes`: Per-series type override for combined charts
- `hiddenSeries`: Set of hidden series names
- `showDataLabels`: Boolean for data label display
- `title` / `subtitle`: Editable chart metadata

Chat state in `ChatPanel`:
- `messages`: Array of `{role, content}` objects
- `input`: Current user input

## Design System - CRITICAL

**See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete specification.**

### Non-Negotiable Rules

1. **shadcn/ui only** - Never build UI primitives from scratch. Add components via `npx shadcn@latest add <component>`
2. **Spacing**: `p-8` for cards, `gap-8` for layouts (not p-6 or gap-4)
3. **Premium styling**: Glass effect (`backdrop-blur-xl`), gradient accents, colored shadows
4. **Transitions**: Always use `transition-smooth` (300ms ease-out)
5. **Colors**: Premium chart palette (vibrant purple, ocean blue, emerald green, rich violet, warm amber), gradient text for headings
6. **Empty states**: Welcoming copy + suggested action buttons
7. **Accessibility**: aria-labels, semantic HTML, keyboard navigation
8. **Quality check**: Does it look like a $200 Framer template?

### Essential Patterns

**Cards:**
```tsx
<Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-smooth">
  <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
  <CardHeader className="space-y-3 pb-6">
    <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
      Title
    </CardTitle>
  </CardHeader>
</Card>
```

**Buttons:**
```tsx
<Button className="bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30" />
```

**Typography:**
- Hero: `text-7xl md:text-8xl font-bold tracking-tighter`
- Sections: `text-3xl font-bold tracking-tight`
- Body: `text-sm font-medium`

**Icons:**
- Use lucide-react exclusively
- Inline: `w-4 h-4`, Features: `w-8 h-8`

### Chart Styling (Recharts)

All charts must include:
- Gradient definitions for fill colors (see ChartPanel.tsx:66-83)
- Subtle grid: `strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false}`
- Styled axes with custom fonts, colors, no tick lines
- Premium tooltip with glass effect, rounded corners, shadow
- Clickable legend for series toggling
- Rounded bar corners: `radius={[8, 8, 0, 0]}`

### Global Styles

`index.css` defines:
- `gradient-mesh`: Premium radial gradient background
- `glass`: Backdrop blur with transparent white background
- `transition-smooth`: Standard 300ms ease-out transition
- Chart color CSS variables (--chart-1 through --chart-5)

## Code Standards

- **TypeScript strict mode** - No `any` types allowed
- **Tailwind classes only** - No inline styles
- **Component files >300 lines** should be split
- **Separation of concerns** - Keep state, UI, and logic organized
- **Accessibility** - ARIA labels on icon buttons, semantic HTML, focus states
- **File naming** - PascalCase for components (e.g., `ChartPanel.tsx`)

### LLM Integration Rules

- **LLM order**: Gemini Flash (primary) → Claude Haiku (fallback)
- **Shared logic**: Both LLMs must use identical prompts and parsing logic (see `src/services/ai/shared/`)
- **Frontend agnostic**: Frontend code should never care which LLM is being used - they're interchangeable backends

## Pull Request Checklist

See [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) for full checklist.

Key requirements:
- [ ] Uses shadcn/ui components
- [ ] Premium styling (glass, shadows, gradients)
- [ ] Proper spacing (p-8 for cards, gap-8 for layouts)
- [ ] Smooth transitions on interactive elements
- [ ] Gradient accent bars on cards
- [ ] Empty states with suggested actions
- [ ] ARIA labels and focus states
- [ ] No inline styles, TypeScript strict
- [ ] Looks like a $200 Framer template

## Documentation

**Permanent (committed):**
- **docs/DESIGN_SYSTEM.md** - Component patterns, colors, spacing
- **docs/README.md** - Setup and features
- **docs/adr/ARCHITECTURE.md** - Architecture decision records
- **.github/PULL_REQUEST_TEMPLATE.md** - Quality checklist

**Temporary (gitignored):**
Store in `docs/temp/`. Examples: `2025-11-09-STATUS.md`, `IMPLEMENTATION_PLAN.md`

## Future Roadmap

- AI integration with Gemini/OpenAI for natural language chart modifications
- More chart types (pie, scatter, area)
- Advanced customization options (colors, animations, themes)
- Data import from CSV/Excel/APIs
- Export charts as images/PDFs
- User authentication and saved charts
- Real-time collaboration

## Common Patterns

### Adding a New shadcn/ui Component

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `src/components/ui/` and can be customized with Tailwind classes.

### Chart Data Format

```typescript
const data = [
  { quarter: 'Q1', 'Product A': 240, 'Product B': 139, ... },
  { quarter: 'Q2', 'Product A': 300, 'Product B': 200, ... },
  // ...
]
```

- First property is x-axis key (e.g., 'quarter')
- Remaining properties are series (e.g., 'Product A', 'Product B')

### Gradient Definitions in Charts

Always define gradients in `<defs>` for bar charts:

```tsx
<defs>
  <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.9}/>
    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.7}/>
  </linearGradient>
</defs>
```

Then reference via `fill="url(#colorA)"` on Bar components.

## Design Philosophy

**Every feature must maintain premium quality.** This means:
- No basic, unstyled components
- Generous spacing creates breathing room
- Smooth micro-interactions on hover/focus
- Gradient accents add visual interest
- Empty states are welcoming, not bare
- Colors are bold and vibrant (purple primary)
- Typography is dramatic with large headings
- Glass morphism creates depth
- Colored shadows enhance elevation

If a component doesn't look like it belongs in a premium product designed by Linear or Revolut, it needs more polish.
