# Test various paths to find correct endpoints
$secret = "dev-secret-erbu-docker-2024"
$userId = "11111111-1111-1111-1111-111111111111"
$roles = "admin"
$scope = "sim-bypass,realtime.connect,admin:trips,admin:drivers,admin:riders,notifications"

function Test-Endpoint($name, $url, $method, $extraHeaders) {
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
    if ($extraHeaders) {
        foreach ($k in $extraHeaders.Keys) {
            $headers[$k] = $extraHeaders[$k]
        }
    }

    Write-Output "--- $name ---"
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method $method -ErrorAction Stop -TimeoutSec 10
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
        $len = [Math]::Min(200, $body.Length)
        Write-Output "  FAIL: $code $($body.Substring(0, $len))"
    }
    Write-Output ""
}

Write-Output "=== DRIVER SERVICE :8060 ==="
Test-Endpoint "GET /api/admin/drivers?page=1&pageSize=10" "http://localhost:8060/api/admin/drivers?page=1&pageSize=10" "GET"
Test-Endpoint "GET /api/admin/drivers?skip=0&take=10" "http://localhost:8060/api/admin/drivers?skip=0&take=10" "GET"
Test-Endpoint "GET /admin/drivers" "http://localhost:8060/admin/drivers" "GET"
Test-Endpoint "GET /api/drivers" "http://localhost:8060/api/drivers" "GET"

Write-Output "=== RIDER SERVICE :8095 ==="
Test-Endpoint "GET /admin/riders" "http://localhost:8095/admin/riders" "GET"
Test-Endpoint "GET /api/admin/riders" "http://localhost:8095/api/admin/riders" "GET"
Test-Endpoint "GET /admin/riders?page=1&pageSize=10" "http://localhost:8095/admin/riders?page=1&pageSize=10" "GET"

Write-Output "=== TRIP SERVICE :8090 ==="
Test-Endpoint "GET /api/admin/trips" "http://localhost:8090/api/admin/trips" "GET"
Test-Endpoint "GET /api/trips" "http://localhost:8090/api/trips" "GET"
Test-Endpoint "GET /admin/trips" "http://localhost:8090/admin/trips" "GET"

Write-Output "=== AUTH SERVICE :5090 ==="
$devHeaders = @{ "X-Device-Id" = "admin-web-bff" }
Test-Endpoint "GET /api/auth/admin/users +DeviceId" "http://localhost:5090/api/auth/admin/users" "GET" $devHeaders
Test-Endpoint "GET /api/admin/users +DeviceId" "http://localhost:5090/api/admin/users" "GET" $devHeaders

Write-Output "=== BILLING :8070 ==="
Test-Endpoint "GET /api/billing/admin/dashboard" "http://localhost:8070/api/billing/admin/dashboard" "GET"
Test-Endpoint "GET /api/admin/billing" "http://localhost:8070/api/admin/billing" "GET"

Write-Output "=== PRICING :8050 ==="
Test-Endpoint "GET /api/admin/pricing/rules" "http://localhost:8050/api/admin/pricing/rules" "GET"
Test-Endpoint "GET /pricing/zones/active" "http://localhost:8050/pricing/zones/active" "GET"
