# Test connections to backend services
$ErrorActionPreference = "Continue"

# DevBypass params
$secret = "dev-secret-erbu-docker-2024"
$userId = "admin-bff"
$roles = "Admin,Operator"
$scope = "erbu-api"

function Get-DevBypassHeaders($method, $path) {
    $exp = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
    $nonce = [Guid]::NewGuid().ToString("N")
    $canonical = "$method`n$path`n$userId`n$roles`n$scope`n$exp`n$nonce"
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256(,$keyBytes)
    $hash = $hmac.ComputeHash($dataBytes)
    $sig = [Convert]::ToBase64String($hash).TrimEnd("=").Replace("+","-").Replace("/","_")
    return @{
        "x-dev-user" = $userId
        "x-dev-roles" = $roles
        "x-dev-scope" = $scope
        "x-dev-exp" = $exp
        "x-dev-nonce" = $nonce
        "x-dev-sig" = $sig
    }
}

function Test-Endpoint($name, $url, $method, $useDevBypass, $devBypassPath) {
    Write-Output "--- $name ---"
    try {
        $headers = @{}
        if ($useDevBypass) {
            $p = if ($devBypassPath) { $devBypassPath } else { ([Uri]$url).AbsolutePath }
            $headers = Get-DevBypassHeaders $method $p
        }
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method $method -ErrorAction Stop -TimeoutSec 8
        Write-Output "  OK: $($resp.StatusCode)"
        $len = [Math]::Min(300, $resp.Content.Length)
        Write-Output "  Body: $($resp.Content.Substring(0, $len))"
    } catch {
        $code = "N/A"
        try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
        Write-Output "  FAIL: HTTP $code - $($_.Exception.Message.Substring(0, [Math]::Min(200, $_.Exception.Message.Length)))"
    }
    Write-Output ""
}

# 1) Test port accessibility (no auth)
Write-Output "======= PORT ACCESSIBILITY (no auth) ======="
Test-Endpoint "Gateway:5100 health" "http://localhost:5100/health" "GET" $false
Test-Endpoint "DriverService:8060 swagger" "http://localhost:8060/swagger/index.html" "GET" $false
Test-Endpoint "RiderService:8095 swagger" "http://localhost:8095/swagger/index.html" "GET" $false
Test-Endpoint "AuthService:5090 swagger" "http://localhost:5090/swagger/index.html" "GET" $false

# 2) Test Gateway with DevBypass
Write-Output "======= GATEWAY WITH DEVBYPASS ======="
Test-Endpoint "Gateway /api/admin/drivers" "http://localhost:5100/api/admin/drivers" "GET" $true
Test-Endpoint "Gateway /admin/riders" "http://localhost:5100/admin/riders" "GET" $true

# 3) Test X-Dev-Token format (simple token)
Write-Output "======= X-DEV-TOKEN FORMAT ======="
$tokenHeaders = @{ "X-Dev-Token" = "dev-secret-erbu-docker-2024:admin-bff:Admin,Operator" }
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5100/api/admin/drivers" -Headers $tokenHeaders -Method GET -ErrorAction Stop -TimeoutSec 8
    Write-Output "  X-Dev-Token OK: $($resp.StatusCode)"
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    Write-Output "  X-Dev-Token FAIL: HTTP $code"
}
Write-Output ""

# 4) Test direct service calls with DevBypass
Write-Output "======= DIRECT SERVICES WITH DEVBYPASS ======="
Test-Endpoint "DriverService:8060 /api/admin/drivers" "http://localhost:8060/api/admin/drivers" "GET" $true
Test-Endpoint "RiderService:8095 /admin/riders" "http://localhost:8095/admin/riders" "GET" $true
Test-Endpoint "AuthService:5090 /api/auth/admin/users" "http://localhost:5090/api/auth/admin/users" "GET" $true
Test-Endpoint "TripService:8090 /api/admin/trips" "http://localhost:8090/api/admin/trips" "GET" $true

# 5) Test direct service calls WITHOUT DevBypass (some may have anonymous endpoints)
Write-Output "======= DIRECT SERVICES NO AUTH ======="
Test-Endpoint "DriverService:8060 /api/admin/drivers (no auth)" "http://localhost:8060/api/admin/drivers" "GET" $false
Test-Endpoint "RiderService:8095 /admin/riders (no auth)" "http://localhost:8095/admin/riders" "GET" $false
