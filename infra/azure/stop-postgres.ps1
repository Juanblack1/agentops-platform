param(
  [Parameter(Mandatory = $false)]
  [string] $ResourceGroupName = "rg-agentops-br-dev",

  [Parameter(Mandatory = $false)]
  [string] $DeploymentName = "main"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$postgresHost = az deployment group show `
  --resource-group $ResourceGroupName `
  --name $DeploymentName `
  --query properties.outputs.postgresServerHost.value `
  --output tsv

if ($LASTEXITCODE -ne 0 -or -not $postgresHost) {
  throw "Could not resolve PostgreSQL host from deployment '$DeploymentName'."
}

$serverName = ($postgresHost -split "\.")[0]

az postgres flexible-server stop `
  --resource-group $ResourceGroupName `
  --name $serverName

if ($LASTEXITCODE -ne 0) {
  throw "Could not stop PostgreSQL Flexible Server '$serverName'."
}

az postgres flexible-server show `
  --resource-group $ResourceGroupName `
  --name $serverName `
  --query "{name:name,state:state,location:location}" `
  --output table
