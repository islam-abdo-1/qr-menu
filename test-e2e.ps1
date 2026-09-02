# E2E Test Script for AI Menu Builder
# Run this in PowerShell after starting `npm run dev` in another terminal

$baseUrl = "http://localhost:3000"
$imagePath = "C:\Users\islam\OneDrive\Desktop\QR\imeg\1124140757051928227.jpg"

Write-Host "=== AI Menu Builder E2E Test ===" -ForegroundColor Cyan

# Helper function for API calls
function Invoke-Api {
    param($method, $uri, $body, $headers, $timeout)
    try {
        $params = @{
            Uri         = $uri
            Method      = $method
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        if ($body) { $params.Body = $body }
        if ($headers) { $params.Headers = $headers }
        if ($timeout) { $params.TimeoutSec = $timeout }
        if ($form) { $params.Form = $form }
        $response = Invoke-WebRequest @params
        return $response.Content | ConvertFrom-Json
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "  Response: $body" -ForegroundColor Red
        }
        return $null
    }
}

# 1. Health check
Write-Host "`n1. Health check..." -ForegroundColor Yellow
$health = Invoke-Api -method GET -uri "$baseUrl/api/health"
if ($null -eq $health) { exit 1 }
Write-Host "  ✓ OK" -ForegroundColor Green

# 2. Upload image
Write-Host "`n2. Uploading menu image..." -ForegroundColor Yellow
$form = @{ files = Get-Item -Path $imagePath }
$upload = Invoke-Api -method POST -uri "$baseUrl/api/ai-menu/upload" -form $form
if ($null -eq $upload -or -not $upload.ok) { 
    Write-Host "  ✗ Upload failed: $($upload.error)" -ForegroundColor Red
    exit 1 
}
$jobId = $upload.jobId
Write-Host "  ✓ Uploaded: Job ID = $jobId" -ForegroundColor Green

# 3. Analyze
Write-Host "`n3. Analyzing menu (30-60s)..." -ForegroundColor Yellow
$analyze = Invoke-Api -method POST -uri "$baseUrl/api/ai-menu/analyze" -body '{"jobId":"'$jobId'"}' -headers @{"Content-Type"="application/json"} -timeout 120
if ($null -eq $analyze -or -not $analyze.ok) { 
    Write-Host "  ✗ Analysis failed: $($analyze.error)" -ForegroundColor Red
    exit 1 
}
Write-Host "  ✓ Complete: $($analyze.categoryCount) categories, $($analyze.itemCount) items" -ForegroundColor Green
Write-Host "  Provider: $($analyze.provider)" -ForegroundColor Cyan

# 4. Load job for review
Write-Host "`n4. Loading job for review..." -ForegroundColor Yellow
$job = Invoke-Api -method GET -uri "$baseUrl/api/ai-menu/jobs/$jobId"
if ($null -eq $job -or -not $job.ok) { 
    Write-Host "  ✗ Load failed: $($job.error)" -ForegroundColor Red
    exit 1 
}
Write-Host "  ✓ Loaded: $($job.items.Count) items" -ForegroundColor Green

$items = $job.items
$items | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_.name) | Price: $($_.price) | Cat: $($_.categoryName) | Type: $($_.categoryType) | ImgDetected: $($_.imageDetected) | Review: $($_.needsReview)"
    if ($_.description) { Write-Host "    Desc: $($_.description)" }
    if ($_.variants) { Write-Host "    Variants: $($_.variants | ConvertTo-Json -Compress)" }
}

# 5. Generate images
Write-Host "`n5. Generating images..." -ForegroundColor Yellow
$pendingItems = $items | Where-Object { $_.generationStatus -eq "PENDING" }
Write-Host "  Pending: $($pendingItems.Count)" -ForegroundColor Cyan

if ($pendingItems.Count -gt 0) {
    $maxAttempts = $pendingItems.Count + 5
    $attempt = 0
    $completed = 0
    $failed = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        $gen = Invoke-Api -method POST -uri "$baseUrl/api/ai-menu/generate-images" -body '{"jobId":"'$jobId'"}' -headers @{"Content-Type"="application/json"} -timeout 60
        
        if ($null -eq $gen -or -not $gen.ok) {
            Write-Host "  ✗ Error: $($gen.error)" -ForegroundColor Red
        } elseif ($gen.done) {
            Write-Host "  ✓ Done: $($gen.completed) ok, $($gen.failed) failed" -ForegroundColor Green
            break
        } else {
            switch ($gen.source) {
                "AI_GENERATED" { $completed++; Write-Host "  ✓ AI: $($gen.itemName)" -ForegroundColor Green }
                "MENU_ORIGINAL" { $completed++; Write-Host "  ✓ Original: $($gen.itemName)" -ForegroundColor Green }
                "FAILED" { $failed++; Write-Host "  ✗ Failed: $($gen.itemName) - $($gen.error)" -ForegroundColor Red }
                "NONE" { $completed++; Write-Host "  ○ Skip: $($gen.itemName)" -ForegroundColor Yellow }
                "SKIPPED" { $completed++; Write-Host "  ○ Skip: $($gen.itemName)" -ForegroundColor Yellow }
                default { Write-Host "  ? $($gen.source): $($gen.itemName)" -ForegroundColor Gray }
            }
        }
        Start-Sleep -Seconds 2
    }
}

# 6. Final status
Write-Host "`n6. Final status..." -ForegroundColor Yellow
$job = Invoke-Api -method GET -uri "$baseUrl/api/ai-menu/jobs/$jobId"
if ($job) {
    Write-Host "  Status: $($job.job.status)" -ForegroundColor Green
    Write-Host "  Items: $($job.items.Count)" -ForegroundColor Cyan
    $withImg = ($job.items | Where-Object { $_.finalImageUrl }).Count
    $aiGen = ($job.items | Where-Object { $_.imageSource -eq "AI_GENERATED" }).Count
    $orig = ($job.items | Where-Object { $_.imageSource -eq "MENU_ORIGINAL" }).Count
    Write-Host "  With images: $withImg | AI: $aiGen | Original: $orig" -ForegroundColor Cyan
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Open $baseUrl/admin to review manually" -ForegroundColor Cyan