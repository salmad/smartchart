"""
Data module for SmartChart application.
Provides sample datasets and data loading utilities.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union


def get_sample_sales_data() -> pd.DataFrame:
    """
    Generate a sample sales dataset.
    
    Returns:
        pd.DataFrame: Sample sales data with product, region, quarter and sales columns
    """
    products = ["Product A", "Product B", "Product C", "Product D"]
    regions = ["North", "South", "East", "West"]
    quarters = ["Q1", "Q2", "Q3", "Q4"]
    
    # Create combinations
    data = []
    for product in products:
        for region in regions:
            for quarter in quarters:
                sales = np.random.randint(50, 500)
                data.append({
                    "product": product,
                    "region": region,
                    "quarter": quarter,
                    "sales": sales
                })
    
    return pd.DataFrame(data)


def get_sample_stock_data() -> pd.DataFrame:
    """
    Generate a sample stock price dataset.
    
    Returns:
        pd.DataFrame: Sample stock data with date and price columns
    """
    # Generate dates for the last 30 days
    dates = pd.date_range(end=pd.Timestamp.now(), periods=30)
    
    # Generate random stock prices with a general upward trend
    base_price = 100
    prices = [base_price]
    
    for _ in range(1, 30):
        change = np.random.normal(0.5, 2.0)  # Mean positive drift
        new_price = max(prices[-1] + change, 50)  # Ensure price doesn't go below 50
        prices.append(new_price)
    
    return pd.DataFrame({
        "date": dates,
        "price": prices
    })


def get_dataset(dataset_name: str) -> Optional[pd.DataFrame]:
    """
    Get a dataset by name.
    
    Args:
        dataset_name: Name of the dataset to retrieve
        
    Returns:
        pd.DataFrame or None: The requested dataset or None if not found
    """
    datasets = {
        "sales": get_sample_sales_data,
        "stock": get_sample_stock_data
    }
    
    if dataset_name in datasets:
        return datasets[dataset_name]()
    
    return None
