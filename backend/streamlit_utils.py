import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from typing import List, Dict, Any, Union
from backend.nlp import SimpleChartConfig, SimpleSeriesConfig
from typing import Optional

SHADCN_COLORS = [
    '#000000',  # Black (Strongest contrast)
    '#3B82F6',  # Blue-500 (Vibrant blue for clarity)
    '#10B981',  # Green-500 (Distinct and vibrant green)
    '#F59E0B',  # Amber-500 (Bright amber for distinct contrast)
    '#D1D5DB',  # Gray-300 (Light gray, but still contrasting)
]

def plot_streamlit_charts(
    df: pd.DataFrame,
    series: List[SimpleSeriesConfig],
    chart_title: str = "",
    x_axis_title: str = "",
    y_axis_title: str = "",
    y_axis2_title: Optional[str] = None,
    annotations: Optional[List[Dict]] = None,
    shapes: Optional[List[Dict]] = None,
    barmode: str = "group"
) -> go.Figure:
    """
    Create a Plotly figure from chart configuration and DataFrame.

    Args:
        df: Input DataFrame containing the chart data
        series: List of series configurations (SimpleSeriesConfig objects)
            Each series should specify:
            - x: Column name for x-axis values
            - y: Column name for y-axis values
            - type: Chart type ('bar', 'line', or 'scatter')
            - name: Series display name
            - yaxis: Which y-axis to use ('primary' or 'secondary')
            
        chart_title: Title of the chart
        x_axis_title: Label for x-axis
        y_axis_title: Label for primary y-axis
        y_axis2_title: Optional label for secondary y-axis
        annotations: List of annotations to add to the chart.
            Example:
                [
                    {
                        'x': '2024-06-01',  # x position
                        'y': 1,             # y position
                        'text': 'Note',     # Annotation text
                        'xref': 'x',        # x reference
                        'yref': 'paper'     # y reference
                    }
                ]
        shapes: List of shapes to add to the chart.
            Example:
                [
                    {
                        'type': 'line',     # Shape type
                        'x0': '2024-06-01', # Start x
                        'x1': '2024-06-01', # End x
                        'y0': 0,            # Start y
                        'y1': 1,            # End y
                        'xref': 'x',        # x reference
                        'yref': 'paper'     # y reference
                    }
                ]
        barmode: Mode for bar charts ('group', 'stack', 'overlay', 'relative')
        
    Returns:
        go.Figure: Configured Plotly figure ready for display
    """
    fig = go.Figure()

    for i, series_config in enumerate(series):
        
        # Handle SimpleSeriesConfig objects
        x_col = getattr(series_config, 'x', None)
        y_col = getattr(series_config, 'y', None)
        chart_type = getattr(series_config, 'type', None)
        name = getattr(series_config, 'name', None) or f'Series {i+1}'
        yaxis = getattr(series_config, 'yaxis', None)
        
        # Get data from DataFrame or use direct values
        x_data = df[x_col].values if x_col in df.columns else x_col
        y_data = df[y_col].values if y_col in df.columns else y_col
        
        # Ensure we have valid data arrays
        if isinstance(x_data, str) or isinstance(y_data, str):
            st.error(f"Invalid data reference: x={x_col}, y={y_col}")
            continue
            
        # Add annotations if provided
        if chart_type == 'bar':
            fig.add_trace(go.Bar(
                x=x_data, y=y_data, name=name,
                yaxis='y' if yaxis == 'primary' else 'y2',
                marker_color=SHADCN_COLORS[i % len(SHADCN_COLORS)]
            ))
        elif chart_type == 'line':
            fig.add_trace(go.Scatter(
                x=x_data, y=y_data, name=name, mode='lines',
                yaxis='y' if yaxis == 'primary' else 'y2',
                line_color=SHADCN_COLORS[i % len(SHADCN_COLORS)]
            ))
        elif chart_type == 'scatter':
            fig.add_trace(go.Scatter(
                x=x_data, y=y_data, name=name, mode='markers',
                yaxis='y' if yaxis == 'primary' else 'y2',
                marker_color=SHADCN_COLORS[i % len(SHADCN_COLORS)]
            ))
    if annotations:
        for annotation in annotations:
            fig.add_annotation(**annotation)
        # Add shapes if provided
    if shapes:
        for i, shape in enumerate(shapes):
            shape = shape | {'fillcolor':SHADCN_COLORS[i+1]}
            fig.add_shape(**shape)

    # Update layout for Shadcn aesthetic with configurable axis titles
    fig.update_layout(
        plot_bgcolor='#FFFFFF',  # White background
        paper_bgcolor='#FFFFFF',  # White outer background
        font=dict(family='Arial', color='black'),
        title=dict(text=chart_title, font=dict(size=16)),
        barmode=barmode,
        xaxis=dict(
            title=x_axis_title,
            showgrid=True,
            gridcolor='#EAEAEA',
            zeroline=False
        ),
        yaxis=dict(
            title=y_axis_title,
            showgrid=True,
            gridcolor='#EAEAEA',
            zeroline=False
        ),
        margin=dict(l=40, r=40, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=0.99)
        
    )

    # Configure secondary y-axis if used
    has_secondary = any(
        (getattr(s, 'yaxis', None) == 'secondary')
        for s in series
    )
    if has_secondary:
        fig.update_layout(
            yaxis2=dict(
                title=y_axis2_title or 'Secondary Y-axis',
                overlaying='y',
                side='right',
                showgrid=False
            )
        )

    
    # Display the chart in Streamlit
    st.plotly_chart(fig, use_container_width=True)