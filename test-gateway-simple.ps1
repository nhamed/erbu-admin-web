# Test with simpler params that worked before (admin-bff, erbu-api)
$secret = "dev-secret-erbu-docker-2024"

function Test-Gateway($label, $userId, $roles, $scope, $path) {
    $method = "GET"
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
        "X-Device-Id" = "22222222-2222-2222-2222-222222222222"
    }

    Write-Output "--- $label ---"
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5100$path" -Headers $headers -Method GET -ErrorAction Stop -TimeoutSec 10
        Write-Output "  OK: $($resp.StatusCode) [len=$($resp.Content.Length)]"
        Write-Output "  $($resp.Content.Substring(0, [Math]::Min(300, $resp.Content.Length)))"
    } catch {
        $code = "N/A"
        try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
        $body = ""
        try {
            $s = $_.Exception.Response.GetResponseStream()
            $r = New-Object System.IO.StreamReader($s)
            $body = $r.ReadToEnd()
        } catch {}
        Write-Output "  FAIL: $code $(if($body){$body.Substring(0,[Math]::Min(200,$body.Length))})"
    }
    Write-Output ""
}

# Original working combo (got 400 from auth-service = auth passed)
Test-Gateway "admin-bff/admin/erbu-api" "admin-bff" "admin" "erbu-api" "/api/admin/users"

# WPF-style with GUID userId
Test-Gateway "GUID/admin/sim-bypass" "11111111-1111-1111-1111-111111111111" "admin" "sim-bypass,realtime.connect,admin:trips,admin:drivers,admin:riders,notifications" "/api/admin/users"

# Hybrid: GUID userId + simple scope
Test-Gateway "GUID/admin/erbu-api" "11111111-1111-1111-1111-111111111111" "admin" "erbu-api" "/api/admin/users"

# Test admin riders through Gateway (specific routes)
Test-Gateway "admin-bff riders" "admin-bff" "admin" "erbu-api" "/admin/riders"
