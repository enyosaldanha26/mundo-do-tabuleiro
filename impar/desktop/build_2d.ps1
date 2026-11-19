$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "Computador_2D"
$pkgDir = Join-Path $env:TEMP "wv2_pkg\extracted"

if (-not (Test-Path "$pkgDir\lib\net462\Microsoft.Web.WebView2.WinForms.dll")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "wv2_pkg") | Out-Null
    $nupkg = Join-Path $env:TEMP "wv2_pkg\wv2.zip"
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2792.45" -OutFile $nupkg
    Expand-Archive -Path $nupkg -DestinationPath $pkgDir -Force
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$coreDll = "$pkgDir\lib\net462\Microsoft.Web.WebView2.Core.dll"
$wfDll = "$pkgDir\lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$loaderDll = "$pkgDir\runtimes\win-x64\native\WebView2Loader.dll"

& $csc /nologo /target:winexe /platform:x64 /optimize+ `
    /win32icon:"$PSScriptRoot\Impar.ico" `
    /out:"$outDir\Impar2D.exe" `
    /reference:"System.dll" `
    /reference:"System.Drawing.dll" `
    /reference:"System.Windows.Forms.dll" `
    /reference:"$coreDll" `
    /reference:"$wfDll" `
    "$PSScriptRoot\Program2D.cs" "$PSScriptRoot\MainForm2D.cs"

if ($LASTEXITCODE -ne 0) {
    throw "Falha na compilação do Impar2D.exe"
}

Copy-Item $coreDll $outDir -Force
Copy-Item $wfDll $outDir -Force
Copy-Item $loaderDll $outDir -Force

$targetApp = Join-Path $outDir "impar_2d"
if (Test-Path $targetApp) { Remove-Item -Recurse -Force $targetApp }
Copy-Item -Recurse -Force (Join-Path $root "impar_2d") $targetApp

Write-Host "Build 2D concluído com sucesso em: $outDir\Impar2D.exe"
