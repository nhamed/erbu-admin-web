# Test with WPF-identical DevBypass parameters
$secret = "dev-secret-erbu-docker-2024"
$userId = "11111111-1111-1111-1111-111111111111"
$roles = "admin"
$scope = "sim-bypass,realtime.connect,admin:trips,admin:drivers,admin:riders,notifications"

function Test-Endpoint($name, $url, $method) {
    $path = ([Uri]$url).AbsolutePath
    $exp = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
    $nonce = [Guid]::NewGuid().ToString("N")
    $canonical = "$method`n$path`n$userId`n$roles`n$scope`n$exp`n$nonce"
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256(,$keyBytes)
    $hash = $hmac.ComputeHash($dataBytes)
    $sig = [Convert]::ToBase64String($hash).TrimEnd("=").Replace("+","-").Replace("/","_")

    $headers = @{
        "x-dev-user" = $userId
        "x-dev-roles" = $roles
        "x-dev-scope" = $scope
        "x-dev-exp" = $exp
        "x-dev-nonce" = $nonce
        "x-dev-sig" = $sig
    }

    Write-Output "--- $name ($url) ---"
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method $method -ErrorAction Stop -TimeoutSec 10
        Write-Output "  OK: $($resp.StatusCode)"
        $len = [Math]::Min(300, $resp.Content.Length)
        Write-Output "  Body: $($resp.Content.Substring(0, $len))"
    } catch {
        $code = "N/A"
        try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
        Write-Output "  FAIL: HTTP $code"
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            $len = [Math]::Min(300, $body.Length)
            Write-Output "  Body: $($body.Substring(0, $len))"
        } catch {}
    }
    Write-Output ""
}

# Test direct service calls (WPF style)
Test-Endpoint "DriverService DIRECT" "http://localhost:8060/api/admin/drivers" "GET"
Test-Endpoint "RiderService DIRECT" "http://localhost:8095/admin/riders" "GET"
Test-Endpoint "AuthService DIRECT" "http://localhost:5090/api/auth/admin/users" "GET"
Test-Endpoint "TripService DIRECT" "http://localhost:8090/api/admin/trips" "GET"
Test-Endpoint "BillingService DIRECT" "http://localhost:8070/api/billing/dashboard" "GET"
Test-Endpoint "NotificationService DIRECT" "http://localhost:5085/api/admin/alerts" "GET"
Test-Endpoint "GeocodingService DIRECT" "http://localhost:5080/api/admin/geo-search/status" "GET"

# Also test through Gateway with correct roles
Test-Endpoint "Gateway with admin role" "http://localhost:5100/api/admin/drivers" "GET"
