param(
  [Parameter(Mandatory = $false)]
  [string] $ResourceGroupName = "rg-agentops-br-dev",

  [Parameter(Mandatory = $false)]
  [string] $DeploymentName = "main",

  [Parameter(Mandatory = $false)]
  [string] $NamePrefix = "agentopsbrdev",

  [Parameter(Mandatory = $false)]
  [string] $ImageTag = "dev",

  [Parameter(Mandatory = $false)]
  [ValidateSet("mock", "google", "litellm")]
  [string] $LlmProvider = "mock",

  [Parameter(Mandatory = $false)]
  [string] $CorsOrigins = ""
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Read-EnvFileValue([string] $Path, [string] $Name) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  return $line.Substring($Name.Length + 1)
}

$outputs = az deployment group show `
  --resource-group $ResourceGroupName `
  --name $DeploymentName `
  --query properties.outputs `
  --output json | ConvertFrom-Json

$registryName = $outputs.containerRegistryName.value
$registryLoginServer = $outputs.containerRegistryLoginServer.value
$backendImage = "$registryLoginServer/agentops/backend:$ImageTag"

if (-not $registryName -or -not $registryLoginServer) {
  throw "Container Registry outputs were not found. Run infra/azure/provision.ps1 first."
}

$tags = az acr repository show-tags `
  --name $registryName `
  --repository agentops/backend `
  --query "[?@=='$ImageTag']" `
  --output tsv 2>$null

if (-not $tags) {
  throw "Image '$backendImage' was not found in ACR. Build and push it before deploying Container Apps."
}

$generatedEnv = Join-Path $PSScriptRoot "..\..\backend\.env.azure.generated"
$apiKeys = $env:AGENTOPS_API_KEYS
if (-not $apiKeys) {
  throw "Set AGENTOPS_API_KEYS before production deploy, for example admin:<long-random-key>."
}

$postgresUrl = $env:POSTGRES_URL
if (-not $postgresUrl) {
  $postgresUrl = Read-EnvFileValue $generatedEnv "POSTGRES_URL"
}

$storageConnectionString = $env:AZURE_STORAGE_CONNECTION_STRING
if (-not $storageConnectionString) {
  $storageConnectionString = Read-EnvFileValue $generatedEnv "AZURE_STORAGE_CONNECTION_STRING"
}

$serviceBusConnectionString = $env:AZURE_SERVICE_BUS_CONNECTION_STRING
if (-not $serviceBusConnectionString) {
  $serviceBusConnectionString = Read-EnvFileValue $generatedEnv "AZURE_SERVICE_BUS_CONNECTION_STRING"
}

$googleApiKey = $env:GOOGLE_GENERATIVE_AI_API_KEY

az deployment group create `
  --resource-group $ResourceGroupName `
  --template-file (Join-Path $PSScriptRoot "container-apps.bicep") `
  --parameters `
    namePrefix=$NamePrefix `
    containerRegistryName=$registryName `
    backendImage=$backendImage `
    apiKeys=$apiKeys `
    llmProvider=$LlmProvider `
    corsOrigins=$CorsOrigins `
    enableApiDocs=false `
    googleGenerativeAiApiKey=$googleApiKey `
    postgresUrl=$postgresUrl `
    azureStorageConnectionString=$storageConnectionString `
    azureServiceBusConnectionString=$serviceBusConnectionString `
  --output table
