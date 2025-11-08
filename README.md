# SmartChart

Interactive chart creation and modification application with natural language processing. Reflex Python project where you chat with charts. "Plot sales by month" and you get a stunning buridan ui / recharts chart.

## Tech
This is a python only project. Use python for backend and python reflex for frontend work. Refer to documentation so that you code better (reflex is quite new library and llms prone to mistakes)

Buridan ui for shadcn components. I think it has recharts access for stunning charts. Charts need to be great, hence rendered by best js libraries like recharts.

## Features
- Create interactive shadcn charts (from within reflex python framework)
- Modify charts using natural language commands


## Setup
1. virtual environment created in .venv folder:
```bash
python -m venv .venv # only first time
.venv\Scripts\activate # to activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the App

1. Activate virtual environment:
```bash
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux
```

2. Run the development server:
```bash
reflex run
# or if reflex command not found:
python -m reflex run
```

3. Open your browser at `http://localhost:3000`


## Project Structure

```
smartchart/
├── smartchart/              # Main application package
│   ├── __init__.py
│   ├── smartchart.py        # App entry point and routing
│   ├── state.py             # State management (ChartState)
│   └── components/          # Reusable UI components
│       ├── __init__.py
│       ├── chat.py          # Chat interface
│       └── chart.py         # Chart rendering
├── rxconfig.py              # Reflex configuration
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (API keys)
├── .env.example             # Example env file
└── knowledge.md             # Project documentation
```

rules - separation of concerns, following best practices and documentation of Reflex for better coding. In general reflex app should follow best practices of react apps in terms of structure (thi is how it was created)
UI components - please use shadcn 

# Design and styling
Great and bold colors from Linear or Revolut - modern web apps, minimalist and design led. Canvas as well. In general inspire yourself from these companies. Build like atproduct manager (at product led company like linear) and engineer in one.

