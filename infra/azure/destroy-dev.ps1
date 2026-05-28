param(
  [Parameter(Mandatory = $false)]
  [string] $ResourceGroupName = "rg-agentops-br-dev",

  [Parameter(Mandatory = $false)]
  [switch] $NoWait
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$exists = az group exists --name $ResourceGroupName --output tsv

if ($exists -ne "true") {
  Write-Host "Resource group '$ResourceGroupName' does not exist."
  exit 0
}

if ($NoWait) {
  az group delete --name $ResourceGroupName --yes --no-wait
  Write-Host "Deletion started for resource group '$ResourceGroupName'."
  exit 0
}

az group delete --name $ResourceGroupName --yes
Write-Host "Deleted resource group '$ResourceGroupName'."
