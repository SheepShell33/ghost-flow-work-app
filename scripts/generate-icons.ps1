#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$assets = Join-Path (Join-Path $root "electron") "assets"
New-Item -ItemType Directory -Path $assets -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-CircleBitmap($size, $color) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $brush = New-Object System.Drawing.SolidBrush($color)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.FillEllipse($brush, 1, 1, $size - 2, $size - 2)
    $g.Dispose()
    $brush.Dispose()
    return $bmp
}

$cyan = [System.Drawing.Color]::FromArgb(255, 0, 240, 255)

# 托盘图标 16x16 PNG
$tray = New-CircleBitmap 16 $cyan
$tray.Save((Join-Path $assets "tray-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$tray.Dispose()

# 应用图标 256x256，先生成 PNG
$app = New-CircleBitmap 256 $cyan
$app.Save((Join-Path $assets "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 再生成 ICO（必须使用 Icon 类保存）
$icoPath = Join-Path $assets "icon.ico"
$ico = [System.Drawing.Icon]::FromHandle($app.GetHicon())
$stream = [System.IO.File]::OpenWrite($icoPath)
$ico.Save($stream)
$stream.Close()
$ico.Dispose()
$app.Dispose()

Write-Host "Icons generated at $assets"
