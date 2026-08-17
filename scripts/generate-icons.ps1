#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

# 使用 Pillow 从项目根目录的 custom-icon.png 生成 icon.png / icon.ico / tray-icon.png
Set-Location $root
uv run --with Pillow python scripts/generate-icons.py
if ($LASTEXITCODE -ne 0) { throw "Icon generation failed with exit code $LASTEXITCODE" }
