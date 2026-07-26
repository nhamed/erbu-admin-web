# Test Gateway with correct DevBypass + X-Device-Id
$secret = "dev-secret-erbu-docker-2024"
$userId = "11111111-1111-1111-1111-111111111111"
$roles = "admin"
$scope = "sim-bypass,realtime.connect,admin:trips,admin:drivers,admin:riders,notifications"

$method = "GET"
$path = "/api/admin/status"
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

Write-Output "--- Gateway /api/admin/status with DevBypass + X-Device-Id ---"
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5100/api/admin/status" -Headers $headers -Method GET -ErrorAction Stop -TimeoutSec 10
    Write-Output "OK: $($resp.StatusCode)"
    $len = [Math]::Min(500, $resp.Content.Length)
    Write-Output $resp.Content.Substring(0, $len)
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    $body = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
    } catch {}
    Write-Output "FAIL: $code"
    if ($body) { Write-Output $body.Substring(0, [Math]::Min(300, $body.Length)) }
}

Write-Output ""
Write-Output "--- Gateway /api/admin/users with DevBypass + X-Device-Id ---"
$path2 = "/api/admin/users"
$exp2 = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
$nonce2 = [Guid]::NewGuid().ToString("N")
$canonical2 = "$method`n$path2`n$userId`n$roles`n$scope`n$exp2`n$nonce2"
$dataBytes2 = [System.Text.Encoding]::UTF8.GetBytes($canonical2)
$hmac2 = New-Object System.Security.Cryptography.HMACSHA256(,$keyBytes)
$hash2 = $hmac2.ComputeHash($dataBytes2)
$sig2 = [Convert]::ToBase64String($hash2).TrimEnd("=").Replace("+","-").Replace("/","_")

$headers2 = @{
    "x-dev-user" = $userId
    "x-dev-roles" = $roles
    "x-dev-scope" = $scope
    "x-dev-exp" = $exp2
    "x-dev-nonce" = $nonce2
    "x-dev-sig" = $sig2
    "X-Device-Id" = "22222222-2222-2222-2222-222222222222"
}

try {
    $resp2 = Invoke-WebRequest -Uri "http://localhost:5100/api/admin/users" -Headers $headers2 -Method GET -ErrorAction Stop -TimeoutSec 10
    Write-Output "OK: $($resp2.StatusCode)"
    $len = [Math]::Min(500, $resp2.Content.Length)
    Write-Output $resp2.Content.Substring(0, $len)
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    $body = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
    } catch {}
    Write-Output "FAIL: $code"
    if ($body) { Write-Output $body.Substring(0, [Math]::Min(500, $body.Length)) }
}
