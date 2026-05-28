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

if (-not $postgresHost) {
  throw "PostgreSQL host was not found in deployment outputs."
}

$serverName = ($postgresHost -split "\.")[0]

az postgres flexible-server parameter set `
  --resource-group $ResourceGroupName `
  --server-name $serverName `
  --name azure.extensions `
  --value vector `
  --output none

if ($LASTEXITCODE -ne 0) {
  throw "Azure rejected the pgvector allowlist update. If the PostgreSQL server is stopped, start it only for the migration window and stop it again afterward."
}

Write-Host "pgvector allowlist enabled on '$serverName'. Run migrations with VECTOR_STORE=pgvector after starting PostgreSQL."
