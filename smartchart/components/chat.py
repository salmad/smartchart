"""Chat interface component for interacting with charts."""

import reflex as rx
from smartchart.state import ChartState


def chat_message(msg: dict) -> rx.Component:
    """Render a single chat message."""
    return rx.cond(
        msg["role"] == "user",
        # User message
        rx.box(
            rx.text(msg["content"], size="3", color="white"),
            background="blue.600",
            padding="0.75rem",
            border_radius="0.5rem",
            max_width="80%",
            align_self="flex-end",
        ),
        # Assistant message
        rx.box(
            rx.text(msg["content"], size="3", color="gray.800"),
            background="gray.100",
            padding="0.75rem",
            border_radius="0.5rem",
            max_width="80%",
            align_self="flex-start",
        ),
    )


def chat_panel() -> rx.Component:
    """Chat panel for natural language chart modifications."""
    return rx.box(
        rx.vstack(
            rx.heading(
                "Chat with your chart",
                size="6",
                margin_bottom="1rem",
            ),
            
            # Chat history
            rx.scroll_area(
                rx.vstack(
                    rx.foreach(
                        ChartState.chat_history,
                        chat_message,
                    ),
                    spacing="3",
                    width="100%",
                ),
                height="400px",
                margin_bottom="1rem",
            ),
            
            # Input area
            rx.form(
                rx.hstack(
                    rx.input(
                        placeholder="Ask to modify the chart...",
                        value=ChartState.current_input,
                        on_change=ChartState.set_input,
                        flex="1",
                    ),
                    rx.button(
                        "Send",
                        type="submit",
                        color_scheme="blue",
                    ),
                    width="100%",
                ),
                on_submit=ChartState.send_message,
                width="100%",
            ),
            
            spacing="4",
            height="100%",
        ),
        padding="1.5rem",
        background="white",
        border_radius="0.75rem",
        box_shadow="lg",
        height="100%",
    )
