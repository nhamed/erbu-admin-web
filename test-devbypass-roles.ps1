# Test DevBypass with different role casings
$secret = "dev-secret-erbu-docker-2024"
$scope = "erbu-api"

function Test-WithRoles($testName, $userId, $roles) {
    $method = "GET"
    $path = "/api/admin/drivers"
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

    Write-Output "--- $testName (user=$userId, roles=$roles) ---"
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5100/api/admin/drivers" -Headers $headers -Method GET -ErrorAction Stop -TimeoutSec 8
        Write-Output "  OK: $($resp.StatusCode)"
        Write-Output "  Body: $($resp.Content.Substring(0, [Math]::Min(200, $resp.Content.Length)))"
    } catch {
        $code = "N/A"
        try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
        Write-Output "  FAIL: HTTP $code"
    }
    Write-Output ""
}

# Test different role casings
Test-WithRoles "Admin,Operator" "admin-bff" "Admin,Operator"
Test-WithRoles "admin,operator" "admin-bff" "admin,operator"
Test-WithRoles "ADMIN,OPERATOR" "admin-bff" "ADMIN,OPERATOR"
Test-WithRoles "admin" "admin-bff" "admin"
Test-WithRoles "superadmin" "admin-bff" "superadmin"

# Test with sim scope
Test-WithRoles "Admin+sim-bypass scope" "sim-admin" "Admin,Operator"
