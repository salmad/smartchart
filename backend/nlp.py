"""
Google Gemini integration for SmartChart.
Handles natural language processing of chart modification requests.
"""
import os
import json
from pathlib import Path
from google import genai
from typing import Dict, List, Optional, Literal, Any
from dotenv import load_dotenv
import sys
from pathlib import Path
import streamlit as st
from pydantic import BaseModel

# Simplified models for Gemini API
class SimpleAnnotation(BaseModel):
    """Simplified annotation for Gemini API"""
    x: Optional[str] = None
    y: Optional[float] = None
    text: str
    xref: Optional[str] = None
    yref: Optional[str] = None

class SimpleShape(BaseModel):
    """Simplified shape for Gemini API"""
    type: Literal['line', 'rect', 'circle', 'path'] = 'line'
    x0: Optional[str] = None
    y0: Optional[float] = None
    x1: Optional[str] = None
    y1: Optional[float] = None
    xref: Optional[str] = None
    yref: Optional[str] = None

class SimpleSeriesConfig(BaseModel):
    """Simplified series configuration for Gemini API"""
    x: str
    y: str
    type: Literal['bar', 'line', 'scatter'] = 'bar'
    name: Optional[str] = None
    yaxis: Literal['primary', 'secondary'] = 'primary'

class SimpleChartConfig(BaseModel):
    """Simplified chart configuration for Gemini API"""
    series: List[SimpleSeriesConfig]
    title: str = "Title"
    x_axis_title: Optional[str] = None
    y_axis_title: Optional[str] = None
    y_axis2_title: Optional[str] = None
    annotations: Optional[List[SimpleAnnotation]] = None
    shapes: Optional[List[SimpleShape]] = None
    barmode: Literal['stack', 'group', 'overlay', 'relative'] = 'group'
    explanation_ai: Optional[str] = None

# Load environment variables
load_dotenv()

class GeminiChartAssistant:
    """
    Handles communication with Google Gemini for chart modifications.
    """
    
    def __init__(self):
        """Initialize Gemini client and load system prompt"""
        self.client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
        self.system_prompt = Path('backend/prompts/system.md').read_text(encoding='utf-8')
    
    def get_chart_modification(self, user_input: str, current_config: Dict) -> Dict:
        """
        Get suggested chart modifications from Gemini.
        
        Args:
            user_input: Natural language request from user
            current_config: Current chart configuration in JSON format
            
        Returns:
            Dictionary with new chart configuration
        """
        prompt = f"""{self.system_prompt}
        
        Current configuration:\n{json.dumps(current_config, indent=2)}
        
        User request:\n{user_input}"""
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': SimpleChartConfig
                }
            )
            
            st.write('Gemini Response:', response.text)
            
            # Process the response
            if response.text:
                try:
                    # First try to use the automatic parsing
                    simple_config: SimpleChartConfig = response.parsed
                    
                    # Convert to our full ChartConfig model
                    config = SimpleChartConfig(**simple_config.model_dump())
                    return config.model_dump()
                except Exception as e:
                    st.write(f"Error with automatic parsing: {e}")
                    try:
                        # Fall back to manual JSON parsing
                        json_data = json.loads(response.text)
                        config = SimpleChartConfig(**json_data)
                        return config.model_dump()
                    except Exception as e2:
                        st.write(f"Error with manual parsing: {e2}")
                        # Last resort: use regex extraction
                        return self._parse_response(response.text)
            else:
                st.write("Empty response from Gemini")
                return {}
                
        except Exception as e:
            st.write(f"Error calling Gemini API: {e}")
            return {}
    
    def _parse_response(self, response_text: str) -> Dict:
        """Extract JSON from Gemini response"""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            return json.loads(response_text[json_start:json_end])
        except Exception as e:
            print(f"Error parsing response: {e}")
            return {}

# Singleton instance
gemini_assistant = GeminiChartAssistant()