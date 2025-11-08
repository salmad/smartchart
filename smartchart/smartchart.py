"""SmartChart - Interactive chart creation with natural language."""

import reflex as rx
from rxconfig import config
from smartchart.state import ChartState
from smartchart.components.chat import chat_panel
from smartchart.components.chart import chart_panel


def index() -> rx.Component:
    """Main dashboard layout."""
    return rx.container(
        rx.color_mode.button(position="top-right"),
        
        rx.vstack(
            # Header
            rx.heading(
                "📊 SmartChart",
                size="9",
                margin_bottom="0.5rem",
            ),
            rx.text(
                "Chat with your charts - create and modify visualizations using natural language",
                size="4",
                color="gray.600",
                margin_bottom="2rem",
            ),
            
            # Main content: Chart and Chat side by side
            rx.grid(
                chart_panel(),
                chat_panel(),
                columns="2",
                spacing="4",
                width="100%",
            ),
            
            spacing="5",
            padding="2rem",
            min_height="100vh",
        ),
        
        max_width="1400px",
    )


app = rx.App(
    theme=rx.theme(
        appearance="light",
        accent_color="blue",
        radius="large",
    )
)
app.add_page(index, title="SmartChart - Chat with Charts")
