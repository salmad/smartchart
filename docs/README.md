# SmartChart

> **Legacy (pre-rewrite).** Setup and stack notes for the old chart app. For the slide-system rewrite, start at section 14 of `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md`.

Interactive chart creation and modification application with natural language processing.

## Tech Stack

- **Framework**: React + TypeScript + Vite
- **UI Components**: shadcn/ui with Tailwind CSS
- **Charts**: Recharts
- **NLP**: Google Gemini API (to be integrated)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
copy .env.example .env  # Windows
cp .env.example .env    # Mac/Linux
```

3. Add your Gemini API key to `.env`:
```
VITE_GEMINI_API_KEY=your_api_key_here
```

## Running the App

```bash
npm run dev
```

Open your browser at `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── ChartPanel.tsx   # Chart rendering
│   └── ChatPanel.tsx    # Chat interface
├── lib/
│   └── utils.ts         # Utility functions
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Features

- 📊 **Premium Interactive Charts** - Recharts with gradient fills and sophisticated styling
- 💬 **AI-Ready Chat Interface** - Natural language commands with empty states and suggestions
- 🎨 **Framer-Template Quality UI** - shadcn/ui components with Linear/Revolut/Canvas inspiration
- ✨ **Glass Morphism Design** - Backdrop blur, gradient mesh backgrounds, colored shadows
- 🚀 **Lightning Fast** - Vite for instant HMR and optimized builds
- 📱 **Fully Responsive** - Beautiful on all screen sizes
- ♿ **Accessible** - ARIA labels, keyboard navigation, semantic HTML

## Design System

**Premium quality required** - see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and [knowledge.md](./knowledge.md)

- Always use shadcn/ui components (`npx shadcn@latest add <component>`)
- Follow spacing rules: p-8 for cards, gap-8 for layouts
- Glass morphism + gradient accents + colored shadows
- Purple primary (#8B5CF6), gradient text, smooth transitions

## Code Standards

- TypeScript strict, no `any` types
- shadcn/ui only - never build UI from scratch
- Tailwind classes only - no inline styles  
- ARIA labels, semantic HTML, keyboard nav
- See DESIGN_SYSTEM.md for styling patterns

## Future Enhancements

- 🤖 AI integration with Gemini API for chart modifications
- 📈 More chart types (line, area, pie, scatter)
- 📊 Advanced customization options
- 📁 Data import from CSV/Excel/APIs
- 🖼️ Export charts as images/PDFs
- 👤 User authentication and saved charts
- 🤝 Real-time collaboration

## Contributing

Use [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) checklist. Every component must look premium.