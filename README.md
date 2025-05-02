# SmartChart

Interactive chart creation and modification application with natural language processing.

## Features
- Create interactive charts using Plotly
- Modify charts using natural language commands
- Modern, clean UI with Gradio
- Real-time updates

## Setup
1. Create virtual environment:
```bash
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the App

### Streamlit Version (Recommended)
```bash
streamlit run backend/streamlit_app.py
```

### Gradio Version (Legacy)
```bash
python backend/app.py
```

## Project Structure
```
.
├── backend/
│   └── app.py
├── docs/
│   ├── architecture.mermaid
│   ├── project_structure.md
│   ├── status.md
│   └── technical.md
├── tasks/
│   └── tasks.md
├── .windsurfrules
├── .gitignore
├── requirements.txt
└── README.md
