# SmartChart Knowledge Base

## Project Overview
SmartChart is an interactive chart creation application using Reflex (Python-only web framework) where users can create and modify charts using natural language.

## Tech Stack
- **Framework**: Reflex (Python full-stack framework, compiles to React)
- **UI Components**: Buridan UI for shadcn-style components
- **Charts**: Recharts (via Reflex's recharts integration)
- **NLP**: Google Gemini API (or OpenAI as alternative)
- **Data Processing**: Pandas, NumPy

## Architecture

### Directory Structure
```
smartchart/
├── smartchart/
│   ├── __init__.py
│   ├── smartchart.py      # Main app entry point
│   ├── state.py            # State management
│   └── components/
│       ├── __init__.py
│       ├── chat.py         # Chat interface
│       └── chart.py        # Chart rendering
├── rxconfig.py             # Reflex configuration
├── requirements.txt        # Python dependencies
└── .env                    # Environment variables (API keys)
```

### Key Components

1. **State Management** (`state.py`)
   - `ChartState`: Manages chart data, configuration, and chat history
   - Uses Reflex's reactive state system
   - State updates automatically trigger UI re-renders

2. **Chat Component** (`components/chat.py`)
   - Natural language input interface
   - Chat history display
   - Message handling and AI integration

3. **Chart Component** (`components/chart.py`)
   - Recharts integration for data visualization
   - Supports multiple chart types (bar, line, area, pie)
   - Responsive and interactive

## Design Principles

### UI/UX
- Minimalist, modern design inspired by Linear, Revolut, and Canvas
- Bold, clean colors with strong contrast
- Focus on clarity and user experience
- Product-led approach to features

### Code Quality
- Separation of concerns (state, components, pages)
- Follow Reflex best practices
- Type hints for all functions
- Clear, documented code

### Reflex-Specific Patterns
- Components are Python functions returning `rx.Component`
- Use `rx.State` for reactive state management
- Event handlers are class methods in State
- Reflex compiles Python to React, so follow React-like component structure

## Running the App

1. Activate virtual environment:
   ```bash
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # Mac/Linux
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run development server:
   ```bash
   reflex run
   # or
   python -m reflex run
   ```

4. Access at `http://localhost:3000`

## Future Enhancements
- AI integration with Gemini/OpenAI for natural language chart modifications
- More chart types and customization options
- Data import from CSV/Excel/APIs
- Export charts as images/PDFs
- User authentication and saved charts
- Real-time collaboration

## Common Patterns

### Adding a New Component
1. Create file in `smartchart/components/`
2. Define component as function returning `rx.Component`
3. Import and use in pages or other components

### Adding State Variables
1. Add attributes to `ChartState` class in `state.py`
2. Add event handler methods for state mutations
3. Reference in components via `ChartState.variable_name`

### Styling
- Use Reflex's built-in props (color, padding, margin, etc.)
- Tailwind CSS v4 is enabled in rxconfig.py
- Keep styling consistent with modern web app aesthetics
