# Requires: az login
# Usage: .\scripts\deploy-azure.ps1
$ErrorActionPreference = "Stop"
$appName = "vss-jersey-board-" + (Get-Random -Maximum 99999)
$rg = "rg-vss-jersey-board"
$location = "centralindia"
$plan = "plan-vss-jersey-board"

Write-Host "Creating resource group $rg in $location..."
az group create --name $rg --location $location | Out-Null

Write-Host "Creating App Service plan (Free F1 Linux)..."
az appservice plan create --name $plan --resource-group $rg --sku F1 --is-linux | Out-Null

Write-Host "Creating web app $appName..."
az webapp create --name $appName --resource-group $rg --plan $plan --runtime "NODE:20-lts" | Out-Null

az webapp config set --name $appName --resource-group $rg --startup-file "node server.js" | Out-Null
az webapp config appsettings set --name $appName --resource-group $rg --settings "SCM_DO_BUILD_DURING_DEPLOYMENT=true" "WEBSITE_NODE_DEFAULT_VERSION=~20" | Out-Null

Push-Location $PSScriptRoot\..
Write-Host "Deploying source..."
az webapp deploy --name $appName --resource-group $rg --src-path . --type zip --async false
Pop-Location

$hostName = az webapp show --name $appName --resource-group $rg --query defaultHostName -o tsv
$url = "https://$hostName/?room=VSS"
Write-Host ""
Write-Host "Deployed: $url"
Write-Host "Share this link on WhatsApp."
