$method = "GET"
$path = "/api/admin/drivers"
$userId = "admin-bff"
$roles = "Admin,Operator"
$scope = "erbu-api"
$exp = [DateTimeOffset]::UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString()
$nonce = [Guid]::NewGuid().ToString("N")
$secret = "dev-secret-erbu-docker-2024"

$canonical = "$method`n$path`n$userId`n$roles`n$scope`n$exp`n$nonce"
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
$dataBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
$hmac = New-Object System.Security.Cryptography.HMACSHA256(,$keyBytes)
$hash = $hmac.ComputeHash($dataBytes)
$sig = [Convert]::ToBase64String($hash).TrimEnd("=").Replace("+","-").Replace("/","_")

Write-Output "Sig: $sig"

$headers = @{
    "x-dev-user" = $userId
    "x-dev-roles" = $roles
    "x-dev-scope" = $scope
    "x-dev-exp" = $exp
    "x-dev-nonce" = $nonce
    "x-dev-sig" = $sig
}

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5100/api/admin/drivers" -Headers $headers -Method GET -ErrorAction Stop
    Write-Output "HTTP: $($resp.StatusCode)"
    Write-Output $resp.Content.Substring(0, [Math]::Min(300, $resp.Content.Length))
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Output "HTTP: $code"
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Output $body.Substring(0, [Math]::Min(500, $body.Length))
    } catch {
        Write-Output "Could not read response body"
    }
}
