$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "Computador"
$pkgDir = Join-Path $env:TEMP "wv2_pkg\extracted"

if (-not (Test-Path "$pkgDir\lib\net462\Microsoft.Web.WebView2.WinForms.dll")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "wv2_pkg") | Out-Null
    $nupkg = Join-Path $env:TEMP "wv2_pkg\wv2.zip"
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2792.45" -OutFile $nupkg
    Expand-Archive -Path $nupkg -DestinationPath $pkgDir -Force
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Gera ícone .ico nativo para o executável
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(64, 64)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(9, 13, 20))
$blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 174, 239))
$g.FillPolygon($blueBrush, [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF(24, 6)),
    (New-Object System.Drawing.PointF(44, 40)),
    (New-Object System.Drawing.PointF(4, 40))
))
$pinkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(236, 0, 140))
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(9, 13, 20), 3)
$g.FillRectangle($pinkBrush, 26, 22, 32, 32)
$g.DrawRectangle($borderPen, 26, 22, 32, 32)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($whiteBrush, 36, 36, 12, 4)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = Join-Path $PSScriptRoot "Impar.ico"
$fs = [System.IO.File]::Create($icoPath)
$icon.Save($fs)
$fs.Close()
$g.Dispose()
$bmp.Dispose()

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$coreDll = "$pkgDir\lib\net462\Microsoft.Web.WebView2.Core.dll"
$wfDll = "$pkgDir\lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$loaderDll = "$pkgDir\runtimes\win-x64\native\WebView2Loader.dll"

& $csc /nologo /target:winexe /platform:x64 /optimize+ `
    /win32icon:"$icoPath" `
    /out:"$outDir\Impar.exe" `
    /reference:"System.dll" `
    /reference:"System.Drawing.dll" `
    /reference:"System.Windows.Forms.dll" `
    /reference:"$coreDll" `
    /reference:"$wfDll" `
    "$PSScriptRoot\Program.cs" "$PSScriptRoot\MainForm.cs"

if ($LASTEXITCODE -ne 0) {
    throw "Falha na compilação do Impar.exe"
}

Copy-Item $coreDll $outDir -Force
Copy-Item $wfDll $outDir -Force
Copy-Item $loaderDll $outDir -Force

$targetApp = Join-Path $outDir "app"
if (Test-Path $targetApp) { Remove-Item -Recurse -Force $targetApp }
Copy-Item -Recurse -Force (Join-Path $root "app") $targetApp

Write-Host "Build concluído com sucesso em: $outDir\Impar.exe"
