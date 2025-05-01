"""
Chart visualization module for SmartChart application.
Handles chart generation and state management.
"""
import plotly.express as px
import plotly.graph_objects as go
from typing import Dict, Any, List, Optional, Union
import pandas as pd
import json


class ChartState:
    """
    Manages the state of a chart throughout a session.
    Provides methods to create, update, and serialize chart configurations.
    """
    
    def __init__(self):
        """Initialize with default empty chart state"""
        self.dataset = None
        self.chart_type = None
        self.figure = None
        self.config = {}
        self.history = []
    
    def create_chart(self, 
                     dataset: pd.DataFrame, 
                     chart_type: str, 
                     x: str, 
                     y: Union[str, List[str]], 
                     **kwargs) -> go.Figure:
        """
        Create a new chart with the specified parameters.
        
        Args:
            dataset: DataFrame containing the data
            chart_type: Type of chart to create (bar, line, scatter, etc.)
            x: Column name for x-axis
            y: Column name(s) for y-axis
            **kwargs: Additional parameters for the chart
            
        Returns:
            go.Figure: The created Plotly figure
        """
        self.dataset = dataset
        self.chart_type = chart_type
        self.config = {
            'x': x,
            'y': y,
            **kwargs
        }
        
        # Create the appropriate chart based on type
        if chart_type == 'bar':
            self.figure = px.bar(dataset, x=x, y=y, **kwargs)
        elif chart_type == 'line':
            self.figure = px.line(dataset, x=x, y=y, **kwargs)
        elif chart_type == 'scatter':
            self.figure = px.scatter(dataset, x=x, y=y, **kwargs)
        elif chart_type == 'pie':
            self.figure = px.pie(dataset, names=x, values=y, **kwargs)
        else:
            # Default to bar chart
            self.figure = px.bar(dataset, x=x, y=y, **kwargs)
        
        # Add to history
        self._add_to_history()
        
        return self.figure
    
    def update_chart(self, updates: Dict[str, Any]) -> go.Figure:
        """
        Update the current chart with new parameters.
        
        Args:
            updates: Dictionary of parameters to update
            
        Returns:
            go.Figure: The updated Plotly figure
        """
        # Update config
        self.config.update(updates)
        
        # If chart_type is in updates, update the chart type
        if 'chart_type' in updates:
            self.chart_type = updates['chart_type']
        
        # Create a clean config without internal parameters
        plot_config = {k: v for k, v in self.config.items() 
                      if k not in ['chart_type']}
        
        # Recreate the chart with updated config
        if self.chart_type == 'bar':
            self.figure = px.bar(self.dataset, **plot_config)
        elif self.chart_type == 'line':
            self.figure = px.line(self.dataset, **plot_config)
        elif self.chart_type == 'scatter':
            self.figure = px.scatter(self.dataset, **plot_config)
        elif self.chart_type == 'pie':
            # Handle special case for pie charts
            names = plot_config.get('names', plot_config.get('x'))
            values = plot_config.get('values', plot_config.get('y'))
            self.figure = px.pie(self.dataset, names=names, values=values, 
                                **{k: v for k, v in plot_config.items() 
                                   if k not in ['x', 'y', 'names', 'values']})
        
        # Add to history
        self._add_to_history()
        
        return self.figure
    
    def _add_to_history(self):
        """Add current state to history"""
        self.history.append({
            'chart_type': self.chart_type,
            'config': self.config.copy()
        })
    
    def undo(self) -> Optional[go.Figure]:
        """
        Revert to previous chart state.
        
        Returns:
            go.Figure or None: The previous chart state or None if no history
        """
        if len(self.history) < 2:
            return None
        
        # Remove current state
        self.history.pop()
        
        # Get previous state
        prev_state = self.history[-1]
        self.chart_type = prev_state['chart_type']
        self.config = prev_state['config']
        
        # Recreate the chart
        return self.update_chart({})
    
    def to_json(self) -> str:
        """
        Serialize the current chart state to JSON.
        
        Returns:
            str: JSON representation of the chart state
        """
        if self.figure is None:
            return "{}"
        
        return json.dumps({
            'chart_type': self.chart_type,
            'config': self.config,
            'figure': self.figure.to_dict()
        })
    
    @classmethod
    def from_json(cls, json_str: str) -> 'ChartState':
        """
        Create a ChartState from a JSON string.
        
        Args:
            json_str: JSON representation of a chart state
            
        Returns:
            ChartState: Reconstructed chart state
        """
        data = json.loads(json_str)
        state = cls()
        
        state.chart_type = data.get('chart_type')
        state.config = data.get('config', {})
        
        if 'figure' in data:
            state.figure = go.Figure(data.get('figure'))
        
        return state


def create_default_chart() -> go.Figure:
    """
    Create a default chart for initial display.
    
    Returns:
        go.Figure: A simple default chart
    """
    # Create a simple bar chart with placeholder data
    fig = px.bar(
        x=["A", "B", "C"],
        y=[3, 1, 2],
        title="Sample Chart (Use chat to modify)"
    )
    
    # Add a watermark annotation
    fig.add_annotation(
        text="SmartChart",
        x=0.5,
        y=0.5,
        xref="paper",
        yref="paper",
        showarrow=False,
        font=dict(
            size=30,
            color="rgba(150,150,150,0.2)"
        )
    )
    
    return fig
