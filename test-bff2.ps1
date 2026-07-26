# Test BFF routes that should work through Gateway
$ErrorActionPreference = "Continue"

function Test-Bff($name, $path, $method) {
    Write-Output "--- $name ---"
    $url = "http://localhost:5200$path"
    try {
        $resp = Invoke-WebRequest -Uri $url -Method $method -ErrorAction Stop -TimeoutSec 10
        Write-Output "  OK: $($resp.StatusCode) [len=$($resp.Content.Length)]"
        $len = [Math]::Min(300, $resp.Content.Length)
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
        $len = if ($body.Length -gt 0) { [Math]::Min(300, $body.Length) } else { 0 }
        $bodyText = if ($len -gt 0) { $body.Substring(0, $len) } else { "(empty)" }
        Write-Output "  FAIL: $code $bodyText"
    }
    Write-Output ""
}

# Routes that go through Gateway (Hybrid auth mode accepts DevBypass)
Write-Output "=== GATEWAY-ROUTED ENDPOINTS ==="

# Auth admin routes (Gateway has specific routes)
Test-Bff "Auth admin status" "/api/auth/admin/status" "GET"
Test-Bff "Auth admin test-auth" "/api/auth/admin/test-auth" "GET"

# Admin riders (Gateway has specific routes at /admin/riders)
Test-Bff "Admin riders (via gateway)" "/api/admin/riders" "GET"

# Gateway catch-all sends /api/admin/* to auth-service
Test-Bff "Gateway admin catch-all" "/api/admin/test-auth" "GET"

# SPA serving
Write-Output "=== SPA SERVING ==="
Test-Bff "Root HTML" "/" "GET"
Test-Bff "Index.html direct" "/index.html" "GET"
Test-Bff "Cockpit HTML" "/cockpit/" "GET"
Test-Bff "Cockpit index" "/cockpit/index.html" "GET"
