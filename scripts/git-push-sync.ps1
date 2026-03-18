# Git Sync and Push Helper for PowerShell 5.1
# usage: .\git-push-sync.ps1 "commit message"

param (
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

$ErrorActionPreference = "Stop"

function Invoke-GitSafe {
    param(
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$ArgsList
    )
    
    # Check for index.lock and wait/remove if necessary
    if (Test-Path ".git/index.lock") {
        Write-Host "Warning: Found .git/index.lock. Attempting to remove..." -ForegroundColor Yellow
        Remove-Item ".git/index.lock" -Force -ErrorAction SilentlyContinue
    }

    git @ArgsList
}

try {
    Write-Host "--- Starting Git Sync ---" -ForegroundColor Cyan
    
    # 1. Ensure we are on develop
    Invoke-GitSafe checkout develop

    # [NEW] Pre-push Build Verification
    Write-Host "--- Running Build Verification (tsc) ---" -ForegroundColor Cyan
    npx tsc
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build Verification Failed! Fix TS errors before pushing." -ForegroundColor Red
        exit 1
    }
    Write-Host "Build Verification Passed." -ForegroundColor Green
    
    # 2. Add and Commit
    # Note: Using . since we usually want to commit all changes in this workflow
    git add .
    
    # Check if there are changes to commit
    $status = git status --porcelain
    if ($status) {
        Invoke-GitSafe commit -m "$CommitMessage"
    } else {
        Write-Host "No changes to commit on develop." -ForegroundColor Gray
    }

    # 3. Push develop
    Write-Host "Pushing develop..." -ForegroundColor Cyan
    Invoke-GitSafe push origin develop

    # 4. Sync to main
    Write-Host "Syncing to main..." -ForegroundColor Cyan
    Invoke-GitSafe checkout main
    Invoke-GitSafe merge develop
    Invoke-GitSafe push origin main

    # 5. Return to develop
    Invoke-GitSafe checkout develop
    
    Write-Host "--- Git Sync Completed Successfully ---" -ForegroundColor Green
} catch {
    Write-Host "Error during Git operations: $_" -ForegroundColor Red
    exit 1
}
