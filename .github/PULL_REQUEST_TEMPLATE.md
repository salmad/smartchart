## Description

<!-- Brief description of changes -->

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] UI enhancement
- [ ] Refactoring
- [ ] Documentation

## Design Quality Checklist

**MANDATORY for all UI changes:**

### Component Standards
- [ ] Uses shadcn/ui components (never custom UI primitives)
- [ ] Applied premium styling (glass, shadows, gradients)
- [ ] Includes hover and focus states
- [ ] Has smooth transitions (`transition-smooth`)
- [ ] Follows spacing rules (p-8 for cards, gap-8 for layouts)

### Visual Design
- [ ] Uses correct color palette (purple primary, chart colors)
- [ ] Typography follows scale (see DESIGN_SYSTEM.md)
- [ ] Includes gradient accent bars on cards
- [ ] Has colored shadows (e.g., `shadow-purple-500/10`)
- [ ] Border radius minimum `rounded-lg`
- [ ] Gradient text for major headings

### Interactive Elements
- [ ] Empty states are welcoming with suggestions
- [ ] Buttons have gradient backgrounds
- [ ] Status indicators use colored dots
- [ ] Micro-interactions present (animations, transitions)
- [ ] Icons from lucide-react only

### Accessibility
- [ ] Proper aria-labels on interactive elements
- [ ] Focus states visible and styled
- [ ] Semantic HTML used
- [ ] Keyboard navigation works

### Code Quality
- [ ] TypeScript strict mode (no `any` types)
- [ ] No inline styles (Tailwind only)
- [ ] Follows existing patterns
- [ ] Clear variable/function names

## Screenshots

<!-- Add before/after screenshots for UI changes -->

## Testing

- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Safari (if applicable)
- [ ] Tested responsive behavior
- [ ] Tested dark mode (if applicable)
- [ ] No console errors

## Documentation

- [ ] Updated DESIGN_SYSTEM.md (if adding new patterns)
- [ ] Updated SHADCN_COMPONENTS.md (if adding new components)
- [ ] Added code comments for complex logic

## Final Check

**Does this look like a $200 Framer template?**
- [ ] Yes - Ready for review
- [ ] Not yet - More polish needed

---

*Remember: Our standard is premium, product-led design. If it's not stunning, it's not done.*