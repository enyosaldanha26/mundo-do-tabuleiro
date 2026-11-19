param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootWithSep = $root.TrimEnd('\') + '\'

$listener = $null
$boundPort = $Port

for ($p = $Port; $p -lt ($Port + 20); $p++) {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://127.0.0.1:$p/")
    try {
        $candidate.Start()
        $listener = $candidate
        $boundPort = $p
        break
    } catch {
        try { $candidate.Close() } catch {}
    }
}

if (-not $listener) {
    Write-Error "Nao foi possivel iniciar o servidor nas portas $Port a $($Port + 19)."
    exit 1
}

$url = "http://127.0.0.1:$boundPort/"
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Mundo do Tabuleiro - Servidor Local" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Pasta : $root"
Write-Host "  Acesse: $url" -ForegroundColor Green
Write-Host "  Pressione Ctrl+C ou feche esta janela para parar."
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $url
}

$mimeTypes = @{
    ".html"        = "text/html; charset=utf-8"
    ".js"          = "application/javascript; charset=utf-8"
    ".mjs"         = "application/javascript; charset=utf-8"
    ".css"         = "text/css; charset=utf-8"
    ".json"        = "application/json; charset=utf-8"
    ".webmanifest" = "application/manifest+json; charset=utf-8"
    ".png"         = "image/png"
    ".jpg"         = "image/jpeg"
    ".jpeg"        = "image/jpeg"
    ".gif"         = "image/gif"
    ".webp"        = "image/webp"
    ".svg"         = "image/svg+xml"
    ".ico"         = "image/x-icon"
    ".pdf"         = "application/pdf"
    ".woff"        = "font/woff"
    ".woff2"       = "font/woff2"
    ".mp3"         = "audio/mpeg"
    ".wav"         = "audio/wav"
    ".ogg"         = "audio/ogg"
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        try {
            $rawPath = $ctx.Request.Url.AbsolutePath
            $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
            $rel = $decodedPath.TrimStart('/').Replace('/', '\')

            if ([string]::IsNullOrEmpty($rel)) {
                $targetPath = Join-Path $root "index.html"
            } else {
                $targetPath = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
            }

            if (
                -not $targetPath.Equals($root.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase) -and
                -not $targetPath.StartsWith($rootWithSep, [System.StringComparison]::OrdinalIgnoreCase)
            ) {
                $ctx.Response.StatusCode = 403
                $ctx.Response.Close()
                continue
            }

            if (Test-Path $targetPath -PathType Container) {
                if (-not $rawPath.EndsWith('/')) {
                    $location = $rawPath + '/' + $ctx.Request.Url.Query
                    $ctx.Response.StatusCode = 302
                    $ctx.Response.Headers["Location"] = $location
                    $ctx.Response.Close()
                    continue
                }
                $targetPath = Join-Path $targetPath "index.html"
            }

            if (-not (Test-Path $targetPath -PathType Leaf)) {
                $ctx.Response.StatusCode = 404
                $ctx.Response.ContentType = "text/plain; charset=utf-8"
                $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo nao encontrado")
                $ctx.Response.ContentLength64 = $notFoundBytes.Length
                $ctx.Response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
                $ctx.Response.Close()
                continue
            }

            $ext = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
            $ctx.Response.ContentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($targetPath)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $ctx.Response.Close()
        } catch {
            try {
                $ctx.Response.StatusCode = 500
                $ctx.Response.Close()
            } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
