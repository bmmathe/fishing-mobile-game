# Renders brand.html to the PNG sources @capacitor/assets expects in assets/.
# Run: powershell -File scripts/branding/render.ps1
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $here "..\..")
$html = (Resolve-Path (Join-Path $here "brand.html")).Path -replace "\\", "/"
$out = Join-Path $repo "assets"
New-Item -ItemType Directory -Force $out | Out-Null

$jobs = @(
    @{ hash = "icon";        file = "icon-only.png";       size = "1024,1024" },
    @{ hash = "fg";          file = "icon-foreground.png"; size = "1024,1024" },
    @{ hash = "bg";          file = "icon-background.png"; size = "1024,1024" },
    @{ hash = "splash";      file = "splash.png";          size = "2732,2732" },
    @{ hash = "splash-dark"; file = "splash-dark.png";     size = "2732,2732" }
)

foreach ($j in $jobs) {
    $dest = Join-Path $out $j.file
    & $edge --headless=new --disable-gpu --no-first-run --hide-scrollbars `
        --default-background-color=00000000 `
        --screenshot="$dest" --window-size="$($j.size)" `
        "file:///$html#$($j.hash)" 2>$null | Out-Null
    if (Test-Path $dest) {
        Write-Host "OK  $($j.file)  $((Get-Item $dest).Length) bytes"
    } else {
        Write-Host "FAIL $($j.file)"
    }
}
