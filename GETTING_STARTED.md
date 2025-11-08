# Getting Started with SmartChart

## Quick Start

### 1. Prerequisites
- Python 3.10 or higher
- Virtual environment (recommended)

### 2. Installation

```bash
# Navigate to project directory
cd smartchart

# Activate virtual environment (if not already active)
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# Install dependencies (already done if you ran pip install -r requirements.txt)
pip install -r requirements.txt
```

### 3. Running the Application

```bash
# Start the development server
reflex run
# or
python -m reflex run
```

The application will be available at `http://localhost:3000`

**Note**: First run may take a few minutes as Reflex:
- Installs Node.js dependencies
- Compiles the frontend
- Initializes the development server

### 4. What You'll See

- **Left Panel**: Interactive chart displaying sample sales data by product and quarter
- **Right Panel**: Chat interface to interact with the chart using natural language

### 5. Try It Out

Type messages in the chat like:
- "Change to a line chart"
- "Show only Product A and Product B"
- "Change the colors"

**Note**: AI integration is not yet implemented. The chat will acknowledge messages but won't modify the chart yet.

## Project Structure Overview

```
smartchart/
├── smartchart/              # Main application
│   ├── smartchart.py        # App entry & routing
│   ├── state.py             # State management
│   └── components/
│       ├── chat.py          # Chat UI
│       └── chart.py         # Chart rendering
├── rxconfig.py              # Reflex config
├── requirements.txt         # Dependencies
└── .env                     # API keys (create from .env.example)
```

## Next Steps

### Add AI Integration

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env  # Windows
   cp .env.example .env    # Mac/Linux
   ```

2. Add your API key to `.env`:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. Create an AI service module to process chat messages and update charts

### Customize the Chart

Edit `smartchart/components/chart.py` to:
- Add more chart types
- Customize colors and styling
- Add interactivity features

### Modify the Chat Interface

Edit `smartchart/components/chat.py` to:
- Customize the chat UI
- Add message formatting
- Include suggested prompts

## Troubleshooting

### Port Already in Use
If port 3000 is busy:
```bash
reflex run --frontend-port 3001
```

### Module Not Found Errors
Make sure virtual environment is activated and dependencies installed:
```bash
pip install -r requirements.txt
```

### Reflex Command Not Found
Use the module syntax:
```bash
python -m reflex run
```

## Development Tips

- **Hot Reload**: Changes to Python files automatically reload the app
- **State Management**: All reactive state lives in `ChartState` class
- **Component Pattern**: Create reusable components in `components/` directory
- **Styling**: Use Reflex's built-in props or Tailwind CSS classes

## Learn More

- [Reflex Documentation](https://reflex.dev/docs)
- [Recharts Documentation](https://recharts.org)
- [Project Knowledge Base](./knowledge.md)

Happy coding! 🚀
