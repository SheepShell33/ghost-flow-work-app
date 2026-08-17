"""从项目根目录的 custom-icon.png 生成 Electron 打包所需的各种图标。"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as e:
    print("错误：需要 Pillow 来生成图标。请使用 'uv run --with Pillow python scripts/generate-icons.py' 运行。")
    raise SystemExit(1) from e


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    source = root / "custom-icon.png"
    assets = root / "electron" / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    if not source.exists():
        print(f"错误：找不到图标源文件 {source}")
        return 1

    img = Image.open(source).convert("RGBA")

    # 应用主图标（PNG 源图）
    icon_png = assets / "icon.png"
    img.save(icon_png, format="PNG")
    print(f"generated {icon_png}")

    # 托盘图标 16x16
    tray = img.resize((16, 16), Image.Resampling.LANCZOS)
    tray_path = assets / "tray-icon.png"
    tray.save(tray_path, format="PNG")
    print(f"generated {tray_path}")

    # Windows ICO，包含常见尺寸
    icon_sizes = [16, 32, 48, 64, 128, 256]
    ico_path = assets / "icon.ico"
    img.save(ico_path, format="ICO", sizes=[(s, s) for s in icon_sizes])
    print(f"generated {ico_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
