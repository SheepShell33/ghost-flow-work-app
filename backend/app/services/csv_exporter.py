import pandas as pd


def export_to_csv(df: pd.DataFrame, file_path: str) -> str:
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path
