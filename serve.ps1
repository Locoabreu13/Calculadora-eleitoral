# serve.ps1 — Servidor HTTP estático simples para desenvolvimento local
param([int]$Port = 5500)

$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servidor rodando em http://localhost:$Port/"

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.svg'  = 'image/svg+xml'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response

  $urlPath = $req.Url.LocalPath -replace '/', [System.IO.Path]::DirectorySeparatorChar
  if ($urlPath -eq '\' -or $urlPath -eq '/') { $urlPath = '\index.html' }
  $filePath = Join-Path $root $urlPath.TrimStart('\/')

  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $res.ContentType = $mime
    $res.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
    $res.Headers.Add('Pragma', 'no-cache')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $($req.Url.LocalPath)")
    $res.OutputStream.Write($body, 0, $body.Length)
  }
  $res.OutputStream.Close()
}
