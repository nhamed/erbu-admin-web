# Fetch swagger docs from services
$services = @(
    @{Name="DriverService"; Port=8060},
    @{Name="RiderService"; Port=8095},
    @{Name="TripService"; Port=8090},
    @{Name="AuthService"; Port=5090},
    @{Name="BillingService"; Port=8070},
    @{Name="PricingService"; Port=8050},
    @{Name="NotificationService"; Port=5085},
    @{Name="GeocodingService"; Port=5080},
    @{Name="DriverPresence"; Port=6080},
    @{Name="SupportService"; Port=5095},
    @{Name="AuditService"; Port=8093},
    @{Name="MatchingService"; Port=8021}
)

foreach ($svc in $services) {
    Write-Output "=== $($svc.Name) :$($svc.Port) ==="
    $found = $false
    foreach ($path in @("/swagger/v1/swagger.json", "/swagger/index.html", "/openapi/v1.json")) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:$($svc.Port)$path" -Method GET -ErrorAction Stop -TimeoutSec 5
            if ($resp.StatusCode -eq 200) {
                Write-Output "  Found at: $path"
                if ($path -like "*.json") {
                    # Extract admin paths
                    $json = $resp.Content | ConvertFrom-Json
                    $paths = $json.paths.PSObject.Properties.Name | Where-Object { $_ -match "admin" } | Select-Object -First 15
                    if ($paths) {
                        Write-Output "  Admin paths:"
                        foreach ($p in $paths) { Write-Output "    $p" }
                    } else {
                        # Show first 10 paths
                        $allPaths = $json.paths.PSObject.Properties.Name | Select-Object -First 10
                        Write-Output "  First 10 paths (no admin found):"
                        foreach ($p in $allPaths) { Write-Output "    $p" }
                    }
                }
                $found = $true
                break
            }
        } catch {}
    }
    if (-not $found) {
        Write-Output "  No swagger found"
    }
    Write-Output ""
}
