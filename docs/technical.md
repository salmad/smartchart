# Technical Documentation

## Overview

**Goal**  
Enable users to create rich, interactive charts and then "chat" with them (e.g. "add legend", "remove background") to apply edits in real-time.

## Tech Stack  
- **Language**: Python 3.9+
- **UI Framework**: Gradio (chat + chart pane)  
- **Chart Engine**: Plotly Express (with custom template)  
- **NLP**: OpenAI GPT-4o-mini for intent → JSON-patch  
- **State Management**: Session-based in-memory Python object  

## Architecture  

### Component Structure
1. **Frontend (Gradio)**  
   - Two columns layout:  
     - Left: Plotly figure  
     - Right: Chatbot widget  

2. **Backend**  
   - Endpoint receives user message + current fig JSON  
   - Sends prompt to GPT-4o-mini, gets back chart modifications  
   - Applies patch to Plotly figure, returns updated fig

### Data Flow
1. **User Input Flow**
   - User enters natural language command
   - Command is sent to backend processor
   - Command is parsed by NLP component
   - Modifications are generated and applied
   - Updated chart is returned to UI

2. **Chart State Management**
   - Chart configuration stored as JSON
   - Each modification creates new state
   - State history maintained for undo/redo
   - States can be exported/imported

3. **Error Handling**
   - Invalid modifications are rejected
   - User is notified of invalid requests
   - System maintains last valid state

## Development Guide

### Setup
1. **Prerequisites**
   - Python 3.9+
   - Git
   - OpenAI API key

2. **Environment Setup**
   ```bash
   # Create and activate virtual environment
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Set API key
   set OPENAI_API_KEY=your_api_key_here  # Windows
   export OPENAI_API_KEY=your_api_key_here  # macOS/Linux
   ```

3. **Run Application**
   ```bash
   python backend/app.py
   ```

### Development Workflow

1. **Git Workflow**
   - Branch from `develop` using `feature/XX-feature-name` convention
   - Make atomic commits with task ID references
   - Submit PR to `develop`
   - Squash commits before merge

2. **Code Standards**
   - Follow PEP8 style guidelines
   - Use type hints for all functions
   - Add docstrings to all functions and classes

### Troubleshooting

- **Application Issues**
  - Check Python version and dependencies
  - Verify environment variables
  - Check OpenAI API key validity

- **Performance Issues**
  - Limit datasets to <5000 points
  - Use Plotly's partial updates
  - Cache rendered charts and common modifications

## API Documentation Standards

### Function Documentation
```python
def function_name(param1: type, param2: type) -> return_type:
    """
    Short description of function purpose.
    
    Args:
        param1: Description of parameter 1
        param2: Description of parameter 2
        
    Returns:
        Description of return value
        
    Raises:
        ExceptionType: When and why this exception is raised
    """
```

### Module Documentation
Each module should have a docstring explaining:
- Purpose of the module
- Key classes/functions
- Usage examples

## Testing

- **Test Organization**
  - Unit tests in `tests/unit/`
  - Integration tests in `tests/integration/`
  - Naming convention: `test_<function_name>_<scenario>.py`

- **Running Tests**
  ```bash
  pytest tests/
  ```