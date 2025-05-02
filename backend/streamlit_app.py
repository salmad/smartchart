import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from typing import List, Optional
from backend.data import get_dataset
from backend.nlp import SimpleChartConfig, gemini_assistant, SimpleSeriesConfig
from backend.streamlit_utils import plot_streamlit_charts
import json

# Initialize session state
default_series = [
    SimpleSeriesConfig(
        x='quarter',
        y='Product A', 
        type='bar',
        name='Product A',
        yaxis='primary'
    ),SimpleSeriesConfig(
        x='quarter',
        y='Product B', 
        type='bar',
        name='Product B',
        yaxis='primary'
    )
]

if 'chart_config' not in st.session_state:
    st.session_state.chart_config = SimpleChartConfig(
        series=default_series,  # Use default series instead of empty list
        title="Initializing Chart...",
        x_axis_title="X Axis",
        y_axis_title="Y Axis",
        y_axis2_title=None,
        annotations=None,
        shapes=None,
        barmode='stack',
        explanation_ai=None
    )

if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []

def process_chat_message(user_input: str):
    """Handle user chat message and update chart"""
    st.write('###################################')
    try:
        # Add user message to history
        st.session_state.chat_history.append({"role": "user", "content": user_input})
        # st.write('Current Chart Config:', st.session_state.chart_config.model_dump())
        # Get Gemini response
        response = gemini_assistant.get_chart_modification(
            user_input,
            st.session_state.chart_config.model_dump()
        )
        st.write('Gemini Response:', response)
        
        # Handle both dict and SimpleChartConfig responses
        if not isinstance(response, SimpleChartConfig):
            response = SimpleChartConfig(**response)
            
        st.session_state.chart_config = response
        # Add assistant response
        st.session_state.chat_history.append({
            "role": "assistant", 
            "content": response.explanation_ai or 'chart updated successfully'
        })
        
    except Exception as e:
        st.session_state.chat_history.append({
            "role": "error", 
            "content": f"Failed to process request: {str(e)}"
        })


# Set page config at the top
st.set_page_config(
    page_title="SmartChart",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .stApp {
        background-color: #f8f9fa;
    }
    .sidebar .sidebar-content {
        background-color: #ffffff;
        border-right: 1px solid #e1e4e8;
    }
    .stPlotlyChart {
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stChatInput {
        margin-top: 20px;
    }
</style>
""", unsafe_allow_html=True)

# Title with better spacing
st.title("📊 SmartChart")
st.markdown("---")

df = get_dataset("sales")
df_agg = df.groupby(["quarter", "product"]).agg({"sales": "sum"}).reset_index()
df_pivot = df_agg.pivot(index="quarter", columns="product", values="sales").reset_index()

# st.write(process_chat_message('change to line chart'))
# st.write(st.session_state.chart_config.model_dump())
# st.write(process_chat_message('change to line chart'))
# st.write(st.session_state.chart_config.model_dump())

plot_streamlit_charts(
    df_pivot,
    series=st.session_state.chart_config.series,
    chart_title=st.session_state.chart_config.title,
    x_axis_title=st.session_state.chart_config.x_axis_title,
    y_axis_title=st.session_state.chart_config.y_axis_title,
    y_axis2_title=st.session_state.chart_config.y_axis2_title,
    annotations=st.session_state.chart_config.annotations,
    shapes=st.session_state.chart_config.shapes,
    barmode=st.session_state.chart_config.barmode
)

st.write(st.session_state.chart_config.model_dump())
st.write(st.session_state.chat_history)
# Sidebar content
with st.sidebar:
    st.header("Chat & Controls")
    
    # Chat history
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])

    # Chat input
    if user_input := st.chat_input("Ask to modify the chart..."):
        process_chat_message(user_input)
        st.rerun()
    
    # Instructions
    st.markdown("---")
    st.markdown("""
    **Instructions:**
    - Ask natural language questions to modify the chart
    - Try commands like "make it a bar chart" or "change color to blue"
    """)
