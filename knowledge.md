# SmartChart Knowledge Base

## Project Overview
SmartChart is an interactive chart creation application using React and node js where needed. Here users can create and modify charts using natural language. Modern great lloking app, built by product-led teams such as Linear or Revolut.

## Tech Stack
- **Framework**: React
- **UI Components**: shadcn modern styling from canvas and Linear
- **Charts**: Recharts
- **NLP**: Google Gemini API (or OpenAI as alternative)


## Architecture

### Directory Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components (Button, Card, Input, etc.)
│   ├── ChartPanel.tsx   # Chart rendering with Recharts
│   └── ChatPanel.tsx    # Chat interface for user interaction
├── lib/
│   └── utils.ts         # Utility functions (cn for className merging)
├── App.tsx              # Main application component with layout
├── main.tsx             # React entry point
└── index.css            # Global styles with Tailwind directives
```

### Key Components

**ChartPanel**: Displays interactive charts using Recharts library. Currently shows sample sales data.

**ChatPanel**: Chat interface for natural language interaction. Handles user input and displays conversation history.

**shadcn/ui components**: Button, Card, Input, ScrollArea - reusable UI components following shadcn/ui patterns.

## Design Principles

### UI/UX - Premium Framer Template Quality
**CRITICAL: All new features must maintain this design standard**

**Visual Identity:**
- Premium gradient mesh background with radial gradients (see `gradient-mesh` utility)
- Glass morphism cards with `backdrop-blur-xl` and subtle borders
- Bold purple (#8B5CF6) primary color inspired by Linear
- Gradient text treatments for headings using `bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900`
- Large, dramatic typography: Use `text-7xl md:text-8xl` for main headings
- Rounded corners: `rounded-2xl` for cards, `rounded-xl` for buttons/inputs

**Color Palette:**
- Primary: `hsl(262, 83%, 58%)` - Bold purple
- Chart colors: Purple, Emerald, Rose, Blue, Violet (see CSS variables)
- Shadows: Use colored shadows like `shadow-purple-500/30` for depth
- Gradients: Multi-color gradients for accents (purple→blue→emerald)

**Typography:**
- Font weights: `font-bold` for headings, `font-semibold` for subheadings, `font-medium` for body
- Tracking: `tracking-tight` for headings, `tracking-tighter` for hero text
- Line height: `leading-relaxed` for readable paragraphs

**Spacing & Layout:**
- Generous padding: Cards use `p-8`, not `p-6`
- Large gaps: Use `gap-8` for grid layouts, `gap-4` for components
- Max width: Content containers limited to `max-w-[1600px]`
- Breathing room: `mb-16` for section spacing

**Interactive Elements:**
- Smooth transitions: Always use `transition-smooth` utility (300ms ease-out)
- Hover states: Enhance shadows on hover (e.g., `hover:shadow-purple-500/20`)
- Focus states: Purple ring with `focus:ring-purple-400/20`
- Animations: Use `animate-pulse` for live indicators, `animate-in fade-in` for messages

**Components Must Have:**
- Gradient accent bars (1px height, multi-color gradient)
- Status indicators with colored dots and labels (e.g., "LIVE DATA")
- Empty states with icons, welcoming copy, and suggested actions
- Micro-interactions: hover effects, transitions, subtle animations

**shadcn/ui Usage:**
- **MANDATORY:** ALWAYS use shadcn/ui components from `src/components/ui/` (see SHADCN_COMPONENTS.md)
- Add new components via `npx shadcn@latest add <component-name>`
- Customize ONLY with Tailwind classes, NEVER inline styles
- Every component needs premium touches: glass effect, colored shadows, gradients
- Consistent sizing: `h-11` default, `h-12` large, `p-8` for card padding
- See DESIGN_SYSTEM.md for complete component patterns and examples

**Icons:**
- Use lucide-react icons throughout
- Size: `w-4 h-4` for inline, `w-8 h-8` for feature icons
- Color: Match brand colors (purple, blue, emerald)

### Code Quality
- Separation of concerns (state, components, pages)
- Follow React / Node.js best practices
- TypeScript for ALL files - strict mode enabled
- Use shadcn/ui components - never reinvent UI primitives
- Clear, documented code, split large files (>300 lines)
- Accessibility: aria-labels, semantic HTML, keyboard navigation



## Design Standards - Premium Quality Required

**See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete specification.**

### Non-Negotiable Rules

1. ✅ **shadcn/ui only** - Never build UI primitives from scratch (`npx shadcn@latest add <component>`)
2. ✅ **Spacing**: `p-8` for cards, `gap-8` for layouts (not p-6 or gap-4!)
3. ✅ **Premium styling**: Glass effect, gradient accents, colored shadows
4. ✅ **Transitions**: Use `transition-smooth` everywhere
5. ✅ **Colors**: Purple primary (#8B5CF6), gradient text for headings
6. ✅ **Empty states**: Welcoming copy + suggested actions
7. ✅ **Accessibility**: aria-labels, semantic HTML
8. ✅ **Quality check**: Does it look like a $200 Framer template?

### Essential Patterns

```tsx
// Cards - copy ChartPanel.tsx pattern
<Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 transition-smooth">
  <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
  <CardHeader className="space-y-3 pb-6">
    <CardTitle className="text-3xl font-bold bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
  </CardHeader>
</Card>

// Buttons
<Button className="bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30" />

// Typography: text-7xl md:text-8xl (hero), text-3xl (sections), font-bold tracking-tight
// Icons: lucide-react only (w-4 h-4 inline, w-8 h-8 features)
// Spacing: p-8 cards, gap-8 grids, mb-16 sections
```

## Future Enhancements
- AI integration with Gemini/OpenAI for natural language chart modifications
- More chart types and customization options
- Data import from CSV/Excel/APIs
- Export charts as images/PDFs
- User authentication and saved charts
- Real-time collaboration
