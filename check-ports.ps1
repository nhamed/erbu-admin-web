$ports = @(4200, 4201, 5200)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Port $p : ACTIVE (PID $($conn[0].OwningProcess))"
    } else {
        Write-Host "Port $p : DOWN"
    }
}
