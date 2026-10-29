# Run after: gh auth login
$ErrorActionPreference = "Stop"
$gh = "${env:ProgramFiles}\GitHub CLI\gh.exe"
Set-Location $PSScriptRoot

& $gh auth status | Out-Null

$exists = & $gh repo view vyshnavsvarma2000/vss-jersey-board 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating repo vss-jersey-board..."
  & $gh repo create vss-jersey-board --public --description "VSS CCL jersey board" --source=. --remote=origin --push
} else {
  Write-Host "Repo exists, pushing..."
  git push -u origin main
}

Write-Host ""
Write-Host "Done: https://github.com/vyshnavsvarma2000/vss-jersey-board"
Write-Host "Next: deploy on Render (FREE-HOSTING.md)"
