param(
  [string]$SourceJpg = "C:\Users\xuhan\.gemini\antigravity\brain\98c40508-e406-480b-aea8-5c6379b1c255\sable_app_icon_v2_1795193018517.jpg",
  [string]$OutDir = "d:\opentypora\resources"
)

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$src = [System.Drawing.Bitmap]::FromFile($SourceJpg)
$w = $src.Width
$h = $src.Height

# Auto-detect tight bounding box of the dark squircle (pixels where R+G+B < 680)
$minX = $w; $minY = $h; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $h; $y += 2) {
  for ($x = 0; $x -lt $w; $x += 2) {
    $c = $src.GetPixel($x, $y)
    if (($c.R + $c.G + $c.B) -lt 690) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
$side = [Math]::Max($cropW, $cropH)
$cx = ($minX + $maxX) / 2.0
$cy = ($minY + $maxY) / 2.0
$cropX = [Math]::Max(0, [int]([Math]::Round($cx - $side / 2.0)))
$cropY = [Math]::Max(0, [int]([Math]::Round($cy - $side / 2.0)))
$side = [Math]::Min($side, [Math]::Min($w - $cropX, $h - $cropY))

function New-RoundedIconBitmap([int]$TargetSize) {
  $bmp = New-Object System.Drawing.Bitmap($TargetSize, $TargetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $radius = [float]($TargetSize * 0.225)
  $diam = $radius * 2.0
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $diam, $diam, 180, 90)
  $path.AddArc($TargetSize - $diam, 0, $diam, $diam, 270, 90)
  $path.AddArc($TargetSize - $diam, $TargetSize - $diam, $diam, $diam, 0, 90)
  $path.AddArc(0, $TargetSize - $diam, $diam, $diam, 90, 90)
  $path.CloseFigure()

  $g.SetClip($path)
  $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
  $dstRect = New-Object System.Drawing.Rectangle(0, 0, $TargetSize, $TargetSize)
  $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $path.Dispose()
  $g.Dispose()
  return $bmp
}

# Save 512x512 master PNG (for README & UI)
$png512 = New-RoundedIconBitmap 512
$pngPath = Join-Path $OutDir "icon.png"
$png512.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$png512.Dispose()

# Pack multi-size Windows .ico (16, 32, 48, 64, 128, 256)
$sizes = @(16, 32, 48, 64, 128, 256)
$pngBuffers = @()
foreach ($sz in $sizes) {
  $b = New-RoundedIconBitmap $sz
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBuffers += ,($ms.ToArray())
  $ms.Dispose()
  $b.Dispose()
}

$icoPath = Join-Path $OutDir "icon.ico"
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header (6 bytes)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]
  $buf = $pngBuffers[$i]
  $dimByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
  $bw.Write($dimByte)
  $bw.Write($dimByte)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([uint16]1)
  $bw.Write([uint16]32)
  $bw.Write([uint32]$buf.Length)
  $bw.Write([uint32]$offset)
  $offset += $buf.Length
}

foreach ($buf in $pngBuffers) {
  $bw.Write($buf)
}

$bw.Flush()
$bw.Close()
$fs.Close()
$src.Dispose()

Write-Output "Generated $pngPath and $icoPath successfully."
