param(
  [Parameter(Mandatory = $false)]
  [string] $ResourceGroupName = "rg-agentops-br-dev",

  [Parameter(Mandatory = $false)]
  [string] $DeploymentName = "main"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$exists = az group exists --name $ResourceGroupName --output tsv

if ($exists -ne "true") {
  Write-Host "Resource group '$ResourceGroupName' does not exist."
  exit 0
}

az resource list `
  --resource-group $ResourceGroupName `
  --query "[].{name:name,type:type,location:location}" `
  --output table

$postgresHost = az deployment group show `
  --resource-group $ResourceGroupName `
  --name $DeploymentName `
  --query properties.outputs.postgresServerHost.value `
  --output tsv 2>$null

if ($postgresHost) {
  $serverName = ($postgresHost -split "\.")[0]
  az postgres flexible-server show `
    --resource-group $ResourceGroupName `
    --name $serverName `
    --query "{postgres:name,state:state}" `
    --output table
}
