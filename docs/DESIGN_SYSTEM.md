# SmartChart Design System

> **Mission:** Maintain Framer-template quality across all features. Every component should feel like it was designed by a world-class product team.

## Color System

### Primary Colors
```css
--primary: hsl(262, 83%, 58%)        /* Bold Purple - Linear inspired */
--primary-foreground: hsl(0, 0%, 100%)
```

### Chart Colors

**Premium palette inspired by Linear, Revolut, and Framer:**

```css
--chart-1: hsl(262, 80%, 60%)  /* Vibrant Purple - primary accent */
--chart-2: hsl(199, 89%, 48%)  /* Ocean Blue - professional depth */
--chart-3: hsl(142, 71%, 45%)  /* Emerald Green - growth indicator */
--chart-4: hsl(280, 65%, 60%)  /* Rich Violet - premium secondary */
--chart-5: hsl(24, 95%, 53%)   /* Warm Amber - energy & attention */
```

**Design Philosophy:**
- Sophisticated, slightly desaturated tones that feel premium
- High contrast for data clarity while maintaining elegance
- Color harmony optimized for side-by-side comparison
- Ocean blue replaces basic red for professional applications
- Warm amber adds energy without appearing cheap

### Neutrals
```css
--slate-900: #0f172a  /* Headings */
--slate-700: #334155  /* Body text */
--slate-500: #64748b  /* Secondary text */
--slate-100: #f1f5f9  /* Subtle backgrounds */
```

## Typography

### Scale
- **Hero:** `text-7xl md:text-8xl` (72px/96px) - Main landing headings
- **H1:** `text-5xl` (48px) - Page titles
- **H2:** `text-3xl` (30px) - Section headings
- **H3:** `text-2xl` (24px) - Card titles
- **Body Large:** `text-xl` (20px) - Subtitles
- **Body:** `text-base` (16px) - Default text
- **Small:** `text-sm` (14px) - Labels, captions
- **Tiny:** `text-xs` (12px) - Metadata

### Weights
- `font-bold` (700) - Hero headings
- `font-semibold` (600) - Section headings, buttons
- `font-medium` (500) - Body text, labels
- `font-normal` (400) - Rarely used

### Tracking
- `tracking-tighter` (-0.05em) - Hero text
- `tracking-tight` (-0.025em) - Headings
- Default - Body text

## Spacing

### Component Padding
- **Cards:** `p-8` (32px)
- **Buttons:** `px-5 py-2` (20px/8px)
- **Inputs:** `px-4 py-2` (16px/8px)

### Layout Gaps
- **Grid:** `gap-8` (32px)
- **Component groups:** `gap-4` (16px)
- **Inline elements:** `gap-2` (8px)

### Section Spacing
- **Major sections:** `mb-16` (64px)
- **Minor sections:** `mb-8` (32px)
- **Component spacing:** `mb-4` (16px)

## Border Radius

- **Cards:** `rounded-2xl` (16px)
- **Buttons/Inputs:** `rounded-xl` (12px)
- **Small elements:** `rounded-lg` (8px)
- **Pills/badges:** `rounded-full`

## Shadows

### Elevation Levels
```css
/* Base elevation */
shadow-2xl  /* For cards */

/* Colored shadows for depth */
shadow-purple-500/10  /* Resting state */
shadow-purple-500/20  /* Hover state */
shadow-purple-500/30  /* Pressed/active state */
```

### Usage
- Cards: `shadow-2xl shadow-purple-500/10`
- Buttons: `shadow-lg shadow-primary/30`
- Hover: Increase shadow opacity by 10%

## Effects

### Glass Morphism
```css
.glass {
  @apply backdrop-blur-xl bg-white/80 border border-white/20;
}
```

### Gradients

**Mesh Background:**
```tsx
<div className="gradient-mesh" />
```

**Text Gradients:**
```tsx
<h1 className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
```

**Accent Bars:**
```tsx
<div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
```

## Component Patterns

### Card Structure
```tsx
<Card className="glass border-slate-200/60 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-smooth">
  {/* Gradient accent bar */}
  <div className="h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600" />
  
  <CardHeader className="space-y-3 pb-6">
    {/* Status indicator */}
    <div className="inline-flex items-center gap-2 text-xs font-medium text-purple-600">
      <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
      STATUS LABEL
    </div>
    
    {/* Title with gradient */}
    <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
      Card Title
    </CardTitle>
    
    {/* Subtitle */}
    <p className="text-sm text-slate-500 font-medium">Description</p>
  </CardHeader>
  
  <CardContent className="pb-8">
    {/* Content */}
  </CardContent>
</Card>
```

### Buttons
```tsx
{/* Primary action */}
<Button className="bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30">
  Action
</Button>

{/* Secondary action */}
<Button variant="outline">
  Secondary
</Button>
```

### Inputs
```tsx
<Input 
  className="h-12 rounded-xl border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
  placeholder="Descriptive placeholder..."
/>
```

### Empty States
```tsx
<div className="text-center space-y-4">
  {/* Icon container */}
  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
    <Icon className="w-8 h-8 text-purple-600" />
  </div>
  
  {/* Heading & description */}
  <div className="space-y-2">
    <h3 className="text-lg font-semibold text-slate-900">Empty State Title</h3>
    <p className="text-sm text-slate-500 leading-relaxed">Helpful description</p>
  </div>
  
  {/* Suggested actions */}
  <div className="flex flex-wrap gap-2 justify-center pt-4">
    {suggestions.map((item) => (
      <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200">
        {item}
      </button>
    ))}
  </div>
</div>
```

## Animations

### Transitions
```css
.transition-smooth {
  @apply transition-all duration-300 ease-out;
}
```

### Usage
- Always use `transition-smooth` for hover/focus states
- Message animations: `animate-in fade-in slide-in-from-bottom-2 duration-300`
- Status indicators: `animate-pulse`

## Accessibility

### Required Attributes
- Buttons: `aria-label` for icon-only buttons
- Inputs: `placeholder` that describes expected input
- Interactive elements: Proper focus states with `focus-visible:ring-2`
- Icons: Decorative icons should have `aria-hidden="true"`

### Focus States
```tsx
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2
```

## Icons

### Premium Icon System
Lucide icons are **mandatory** for their consistent stroke width, clean geometries, and premium feel. These icons are specifically chosen for their modern, professional aesthetic that matches top-tier SaaS products.

### Source & Quality Standards
```tsx
import { 
  Sparkles,      // Use for premium/special features
  ArrowUpRight,  // Use for external links/upgrades
  BarChart3,     // Use for data/analytics
  Settings2,     // Use for advanced settings
} from 'lucide-react'
```

### Icon Enhancement Guidelines
- Apply subtle transitions on hover/interaction
- Consider using gradient colors for hero icons
- Add micro-animations for interactive icons
- Use consistent stroke width (default: 2px)
- Maintain proper padding in containers

### Sizing & Presentation
- **Inline text icons:** `w-4 h-4` with `align-middle -mt-px`
- **Feature icons:** `w-8 h-8` with colored backgrounds
- **Hero icons:** `w-12 h-12` with gradient effects
- **Empty states:** `w-16 h-16` in gradient containers

### Premium Color Treatment
```tsx
{/* Gradient icon treatment */}
<Icon className="w-8 h-8 text-transparent bg-clip-text bg-gradient-to-br from-purple-600 to-blue-600" />

{/* Feature icon with background */}
<div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50">
  <Icon className="w-6 h-6 text-purple-600" />
</div>
```

### Strategic Color Usage
- **Primary actions:** `text-purple-600` with hover effects
- **Growth/Success:** `text-emerald-600` with subtle glow
- **Attention/Warning:** `text-amber-600` with emphasis
- **Critical/Danger:** `text-rose-600` with careful use
- **Navigation:** `text-slate-700` with hover `text-purple-600`

## Charts (Recharts)

### Standard Configuration
```tsx
<ResponsiveContainer width="100%" height={420}>
  <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    {/* Always include gradient definitions */}
    <defs>
      <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.9}/>
        <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.7}/>
      </linearGradient>
    </defs>
    
    {/* Subtle grid */}
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false} />
    
    {/* Styled axes */}
    <XAxis 
      dataKey="name" 
      stroke="#64748b"
      style={{ fontSize: '13px', fontWeight: 600 }}
      tickLine={false}
      axisLine={{ stroke: '#e2e8f0' }}
    />
    
    {/* Premium tooltip */}
    <Tooltip
      contentStyle={{
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
        padding: '12px',
      }}
      cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
    />
  </BarChart>
</ResponsiveContainer>
```

## Do's and Don'ts

### ✅ Do
- Use shadcn/ui components for all UI primitives
- Apply gradient accents to cards and buttons
- Include empty states with helpful suggestions
- Add micro-interactions (hover, focus, transitions)
- Use colored shadows for depth
- Maintain generous spacing (p-8 for cards)
- Include status indicators and badges
- Write accessible markup with ARIA labels

### ❌ Don't
- Use basic colors without gradients
- Create components from scratch (use shadcn/ui)
- Use small padding (p-4 or less on cards)
- Forget hover states and transitions
- Use inline styles instead of Tailwind
- Skip empty states
- Ignore accessibility
- Use sharp corners (minimum rounded-lg)

## Review Checklist

Before considering any component complete, verify:

- [ ] Uses shadcn/ui base components
- [ ] Has gradient accent bar (if card)
- [ ] Includes proper hover/focus states
- [ ] Has colored shadows
- [ ] Uses correct spacing (p-8 for cards)
- [ ] Typography follows scale and weights
- [ ] Has smooth transitions (transition-smooth)
- [ ] Includes aria-labels where needed
- [ ] Empty states are welcoming and actionable
- [ ] Icons are from lucide-react
- [ ] Rounded corners (minimum rounded-lg)
- [ ] Gradient text for headings
- [ ] Looks premium - like a $200 Framer template

---

*Remember: If it doesn't look like it could be sold as a premium template, it's not done yet.*