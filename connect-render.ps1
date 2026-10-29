# Run in YOUR PowerShell (logged into GitHub as vyshnavsvarma2000).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$remote = "https://github.com/vyshnavsvarma2000/vss-jersey-board.git"
git remote remove github 2>$null
git remote add github $remote

Write-Host "Pushing main to GitHub..."
git push -u github main:main
if ($LASTEXITCODE -ne 0) {
  Write-Host "If branch mismatch, try: git push -u github main:master"
  git push -u github main:master
}

$deployUrl = "https://render.com/deploy?repo=https://github.com/vyshnavsvarma2000/vss-jersey-board"
Write-Host ""
Write-Host "Opening Render one-click deploy (uses render.yaml in repo)..."
Start-Process $deployUrl
Write-Host $deployUrl
