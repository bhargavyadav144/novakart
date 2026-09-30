param (
    [string]$commitMessage = "Updated NovaKart platform with 7 live portals, Leaflet route corridor navigation, sticky sidebars, and treasury audits"
)

Write-Host "Preparing to stage and push all NovaKart files to GitHub..." -ForegroundColor Green

# Add Git path to environment if needed
if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
    $env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
}

# Check Git installation
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitPath) {
    Write-Host "Git is not installed on your system! Please download and install Git from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Initialize git if needed
if (-not (Test-Path ".git")) {
    Write-Host "Initializing local Git repository..." -ForegroundColor Yellow
    & git init
    & git remote add origin https://github.com/bhargavyadav144/novakart.git
}

# Add remote if not present
$remotes = & git remote
if ($remotes -notcontains "origin") {
    & git remote add origin https://github.com/bhargavyadav144/novakart.git
}

Write-Host "Staging all project files..." -ForegroundColor Cyan
& git add .

Write-Host "Creating commit..." -ForegroundColor Cyan
& git commit -m "$commitMessage"

Write-Host "Pushing changes to GitHub repository (main branch)..." -ForegroundColor Green
& git branch -M main
& git push -u origin main --force

Write-Host "Successfully pushed all NovaKart files to https://github.com/bhargavyadav144/novakart !" -ForegroundColor Green
