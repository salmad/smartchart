"""State management for SmartChart application."""

import reflex as rx
from typing import List, Dict, Any
import numpy as np


class ChartState(rx.State):
    """Manages chart data and configuration."""
    
    # Chat history
    chat_history: List[Dict[str, str]] = []
    
    # Chart configuration
    chart_title: str = "Sales by Product and Quarter"
    chart_type: str = "bar"  # bar, line, area, pie
    
    # Sample data - will be replaced with dynamic data
    chart_data: List[Dict[str, Any]] = []
    
    # Input field
    current_input: str = ""
    
    def set_input(self, value: str):
        """Update the current input value."""
        self.current_input = value
    
    def send_message(self):
        """Process user message and update chart."""
        if not self.current_input.strip():
            return
        
        # Add user message to chat history
        self.chat_history.append({
            "role": "user",
            "content": self.current_input
        })
        
        # TODO: Call AI service to process the request
        # For now, add a placeholder response
        self.chat_history.append({
            "role": "assistant",
            "content": "I'll help you modify the chart. (AI integration coming soon)"
        })
        
        # Clear input
        self.current_input = ""
    
    def load_sample_data(self):
        """Load sample sales data."""
        # Generate sample data with fixed seed for consistency
        np.random.seed(42)
        products = ["Product A", "Product B", "Product C", "Product D"]
        quarters = ["Q1", "Q2", "Q3", "Q4"]
        
        data = []
        for quarter in quarters:
            row = {"quarter": quarter}
            for product in products:
                row[product] = int(np.random.randint(50, 500))
            data.append(row)
        
        self.chart_data = data
    
    @rx.var
    def initialized_data(self) -> List[Dict[str, Any]]:
        """Ensure data is loaded on first access."""
        if not self.chart_data:
            self.load_sample_data()
        return self.chart_data
