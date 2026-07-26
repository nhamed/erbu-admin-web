# Test WITHOUT X-Device-Id to see if it interferes
$secret = "dev-secret-erbu-docker-2024"
$method = "GET"
$path = "/api/admin/users"
$userId = "admin-bff"
$roles = "admin"
$scope = "erbu-api"
$exp = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
$nonce = [Guid]::NewGuid().ToString("N")
$canonical = "$method`n$path`n$userId`n$roles`n$scope`n$exp`n$nonce"
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
$dataBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
$hmac = New-Object System.Security.Cryptography.HMACSHA256(,$keyBytes)
$hash = $hmac.ComputeHash($dataBytes)
$sig = [Convert]::ToBase64String($hash).TrimEnd("=").Replace("+","-").Replace("/","_")

Write-Output "--- NO X-Device-Id ---"
$headers = @{
    "x-dev-user" = $userId
    "x-dev-roles" = $roles
    "x-dev-scope" = $scope
    "x-dev-exp" = $exp
    "x-dev-nonce" = $nonce
    "x-dev-sig" = $sig
}
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5100$path" -Headers $headers -Method GET -ErrorAction Stop -TimeoutSec 10
    Write-Output "OK: $($resp.StatusCode)"
    Write-Output $resp.Content.Substring(0, [Math]::Min(200, $resp.Content.Length))
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    $body = ""
    try {
        $s = $_.Exception.Response.GetResponseStream()
        $r = New-Object System.IO.StreamReader($s)
        $body = $r.ReadToEnd()
    } catch {}
    Write-Output "FAIL: $code $(if($body){$body.Substring(0,[Math]::Min(200,$body.Length))})"
}
Write-Output ""

Write-Output "--- WITH X-Device-Id ---"
$exp2 = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
$nonce2 = [Guid]::NewGuid().ToString("N")
$canonical2 = "$method`n$path`n$userId`n$roles`n$scope`n$exp2`n$nonce2"
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
    $resp2 = Invoke-WebRequest -Uri "http://localhost:5100$path" -Headers2 $headers2 -Method GET -ErrorAction Stop -TimeoutSec 10
    Write-Output "OK: $($resp2.StatusCode)"
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    Write-Output "FAIL: $code"
}

Write-Output ""
Write-Output "--- Port 5100 reachable? ---"
try {
    $test = Invoke-WebRequest -Uri "http://localhost:5100/" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Output "OK: $($test.StatusCode)"
} catch {
    $code = "N/A"
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    Write-Output "FAIL: $code $($_.Exception.Message.Substring(0, [Math]::Min(100, $_.Exception.Message.Length)))"
}
