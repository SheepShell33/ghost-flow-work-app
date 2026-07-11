import pandas as pd


def preview_data(df: pd.DataFrame, max_rows: int = 100) -> dict:
    rows = df.head(max_rows).to_dict(orient="records")
    return {
        "columns": list(df.columns),
        "rows": rows,
        "total_rows": len(df),
        "preview_rows": len(rows),
    }
