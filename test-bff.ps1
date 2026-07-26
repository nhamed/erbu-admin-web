# Test the BFF routing to backend services
$ErrorActionPreference = "Continue"

function Test-Bff($name, $path, $method) {
    Write-Output "--- $name ---"
    $url = "http://localhost:5200$path"
    try {
        $resp = Invoke-WebRequest -Uri $url -Method $method -ErrorAction Stop -TimeoutSec 10
        Write-Output "  OK: $($resp.StatusCode) [len=$($resp.Content.Length)]"
        $len = [Math]::Min(200, $resp.Content.Length)
        Write-Output "  $($resp.Content.Substring(0, $len))"
    } catch {
        $code = "N/A"
        try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
        $body = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
        } catch {}
        $len = if ($body.Length -gt 0) { [Math]::Min(200, $body.Length) } else { 0 }
        $bodyText = if ($len -gt 0) { $body.Substring(0, $len) } else { "(empty)" }
        Write-Output "  FAIL: $code $bodyText"
    }
    Write-Output ""
}

Write-Output "=== BFF ROUTING TEST ==="
Write-Output ""

# Auth admin (BFF -> auth-service:5090)
Test-Bff "Auth admin users" "/api/auth/admin/users" "GET"

# Driver admin (BFF -> portfolio:8104)
Test-Bff "Driver admin" "/api/admin/drivers" "GET"

# Payment monitor (BFF -> payment:8077)
Test-Bff "Payment monitor dashboard" "/api/ops/payment-monitor/dashboard" "GET"

# Support tickets (BFF -> support:5095)
Test-Bff "Support tickets" "/api/admin/support/tickets" "GET"

# Reputation (BFF -> portfolio:8104)
Test-Bff "Reputation summary" "/api/ops/reputation/dashboard" "GET"

# Driver presence (BFF -> presence:6080)
Test-Bff "Driver presence stats" "/api/ops/driver-monitor/presence/stats" "GET"

# Trips (BFF -> trip:8090)
Test-Bff "Admin trips" "/api/admin/trips" "GET"

# Riders (BFF -> rider:8095)
Test-Bff "Admin riders" "/api/admin/riders" "GET"

# Gateway catch-all
Test-Bff "Gateway catch-all (orchestrator)" "/api/admin/orchestrator/dashboard" "GET"

# SPA fallback
Test-Bff "SPA index.html" "/" "GET"
Test-Bff "Cockpit index" "/cockpit/" "GET"
