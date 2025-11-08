"""Chart rendering component using Recharts."""

import reflex as rx
from smartchart.state import ChartState


def chart_panel() -> rx.Component:
    """Main chart display panel."""
    return rx.box(
        rx.vstack(
            rx.heading(
                ChartState.chart_title,
                size="7",
                margin_bottom="1rem",
            ),
            
            # Chart container - will add Recharts integration
            rx.box(
                rx.recharts.bar_chart(
                    rx.recharts.bar(
                        data_key="Product A",
                        fill="#3b82f6",
                    ),
                    rx.recharts.bar(
                        data_key="Product B",
                        fill="#10b981",
                    ),
                    rx.recharts.bar(
                        data_key="Product C",
                        fill="#f59e0b",
                    ),
                    rx.recharts.bar(
                        data_key="Product D",
                        fill="#ef4444",
                    ),
                    rx.recharts.x_axis(data_key="quarter"),
                    rx.recharts.y_axis(),
                    rx.recharts.legend(),
                    rx.recharts.tooltip(),
                    data=ChartState.initialized_data,
                    width="100%",
                    height=400,
                ),
                width="100%",
                padding="1rem",
            ),
            
            spacing="4",
            width="100%",
        ),
        padding="1.5rem",
        background="white",
        border_radius="0.75rem",
        box_shadow="lg",
        height="100%",
    )
