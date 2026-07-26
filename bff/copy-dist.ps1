$bffRoot = "$PSScriptRoot\src\Erbu.Admin.Bff"
$distRoot = "$PSScriptRoot\..\dist\apps"

# erbu-admin-map → wwwroot/
$mapDist = "$distRoot\erbu-admin-map\browser"
$wwwroot = "$bffRoot\wwwroot"

if (Test-Path $mapDist) {
    if (Test-Path $wwwroot) { Remove-Item $wwwroot -Recurse -Force }
    Copy-Item $mapDist $wwwroot -Recurse
    Write-Host "Copied erbu-admin-map dist to wwwroot/ ($((Get-ChildItem $wwwroot -Recurse -File).Count) files)"
} else {
    Write-Host "ERROR: $mapDist not found. Run 'npx nx build erbu-admin-map' first."
    exit 1
}

# erbu-ops-cockpit → wwwroot/cockpit/
$cockpitDist = "$distRoot\erbu-ops-cockpit\browser"
$cockpitWww = "$wwwroot\cockpit"

if (Test-Path $cockpitDist) {
    if (Test-Path $cockpitWww) { Remove-Item $cockpitWww -Recurse -Force }
    Copy-Item $cockpitDist $cockpitWww -Recurse
    $cockpitIndex = "$cockpitWww\index.html"
    if (Test-Path $cockpitIndex) {
        (Get-Content $cockpitIndex -Raw) -replace 'base href="[^"]*"', 'base href="/cockpit/"' | Set-Content $cockpitIndex -Encoding UTF8
    }
    Write-Host "Copied erbu-ops-cockpit dist to wwwroot/cockpit/ ($((Get-ChildItem $cockpitWww -Recurse -File).Count) files)"
} else {
    Write-Host "WARNING: $cockpitDist not found. Cockpit sub-app will not be served."
}

Write-Host "Done. wwwroot ready for BFF serving."
