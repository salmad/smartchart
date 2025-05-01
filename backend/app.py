import gradio as gr
import pandas as pd
from typing import Tuple, List, Dict, Any, Optional
import sys
import os

# Add the parent directory to sys.path to enable relative imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))) 

# Import our custom modules
from backend.data import get_dataset
from backend.charts import ChartState, create_default_chart

# Initialize chart state
chart_state = ChartState()

def handle_user_input(user_input: str, history: List) -> Tuple[List, Any]:
    """
    Process user input and update chart accordingly.
    
    Args:
        user_input: User's text input
        history: Chat history
        
    Returns:
        Tuple containing updated history and chart figure
    """
    history = history or []
    
    # Simple command handling (will be replaced with NLP later)
    response = "I received your command but NLP integration is pending."
    
    if "dataset" in user_input.lower():
        # Handle dataset selection commands
        if "sales" in user_input.lower():
            df = get_dataset("sales")
            if df is not None:
                fig = chart_state.create_chart(
                    df, 
                    "bar", 
                    x="product", 
                    y="sales", 
                    color="region",
                    title="Sales by Product and Region"
                )
                response = "Loaded sales dataset and created bar chart."
        elif "stock" in user_input.lower():
            df = get_dataset("stock")
            if df is not None:
                fig = chart_state.create_chart(
                    df, 
                    "line", 
                    x="date", 
                    y="price",
                    title="Stock Price Over Time"
                )
                response = "Loaded stock dataset and created line chart."
    
    elif "chart" in user_input.lower():
        # Handle chart type changes
        if "bar" in user_input.lower():
            if chart_state.dataset is not None:
                chart_state.update_chart({"chart_type": "bar"})
                response = "Changed to bar chart."
        elif "line" in user_input.lower():
            if chart_state.dataset is not None:
                chart_state.update_chart({"chart_type": "line"})
                response = "Changed to line chart."
        elif "scatter" in user_input.lower():
            if chart_state.dataset is not None:
                chart_state.update_chart({"chart_type": "scatter"})
                response = "Changed to scatter chart."
    
    # Add user message and response to history
    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": response})
    
    # Return updated history and current figure
    return history, chart_state.figure or create_default_chart()

def clear_chat() -> Tuple[List, Any]:
    """Clear chat history but keep current chart"""
    return [], chart_state.figure or create_default_chart()

# Create Gradio interface
with gr.Blocks(title="SmartChart", theme=gr.themes.Soft()) as demo:
    with gr.Row():
        with gr.Column(scale=2):
            chart = gr.Plot(create_default_chart(), label="Chart")
        
        with gr.Column(scale=1):
            chatbox = gr.Chatbot(label="Chat with your Chart", height=400, type="messages")
            with gr.Row():
                user_input = gr.Textbox(
                    placeholder="Enter command (e.g., 'show sales data', 'change to line chart')",
                    show_label=False
                )
                submit_btn = gr.Button("Send", variant="primary")
            
            clear_btn = gr.Button("Clear Chat")
    
    # Set up event handlers
    submit_btn.click(
        fn=handle_user_input,
        inputs=[user_input, chatbox],
        outputs=[chatbox, chart]
    )
    
    user_input.submit(
        fn=handle_user_input,
        inputs=[user_input, chatbox],
        outputs=[chatbox, chart]
    )
    
    clear_btn.click(
        fn=clear_chat,
        inputs=[],
        outputs=[chatbox, chart]
    )

    # Add some helpful instructions
    gr.Markdown("""
    ## SmartChart: Chat with your data
    
    Try these commands:
    - "Show sales dataset"
    - "Show stock dataset"
    - "Change to bar chart"
    - "Change to line chart"
    
    *Full NLP integration coming soon!*
    """)

if __name__ == "__main__":
    demo.launch(share=True)