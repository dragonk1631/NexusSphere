# NexusSphere Blog Backup Script
# Usage: powershell -File scripts/backup_blog.ps1

$source = "b:\NexusSphere\docs\dev_blog"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetBase = "b:\NexusSphere\.backup\blog_vault"
$target = Join-Path $targetBase "backup_$timestamp"

if (Test-Path $source) {
    Write-Host "Backing up blog data to $target..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Copy-Item -Path "$source\*" -Destination $target -Recurse -Force
    Write-Host "Backup completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Source directory not found: $source" -ForegroundColor Red
}
