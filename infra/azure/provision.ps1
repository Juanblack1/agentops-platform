param(
  [Parameter(Mandatory = $true)]
  [string] $ResourceGroupName,

  [Parameter(Mandatory = $true)]
  [string] $Location,

  [Parameter(Mandatory = $false)]
  [string] $NamePrefix = "agentops"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not $env:AGENTOPS_POSTGRES_PASSWORD) {
  throw "Set AGENTOPS_POSTGRES_PASSWORD before running this script."
}

az group create `
  --name $ResourceGroupName `
  --location $Location `
  --output table

az deployment group create `
  --resource-group $ResourceGroupName `
  --template-file "$PSScriptRoot/main.bicep" `
  --parameters namePrefix=$NamePrefix postgresAdminPassword=$env:AGENTOPS_POSTGRES_PASSWORD `
  --output table
