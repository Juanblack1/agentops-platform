param(
  [Parameter(Mandatory = $true)]
  [string] $ResourceGroupName,

  [Parameter(Mandatory = $false)]
  [string] $DeploymentName = "",

  [Parameter(Mandatory = $false)]
  [string] $OutputPath = "backend/.env.azure.generated"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not $env:AGENTOPS_POSTGRES_PASSWORD) {
  throw "Set AGENTOPS_POSTGRES_PASSWORD before running this script."
}

if (-not $DeploymentName) {
  $DeploymentName = az deployment group list `
    --resource-group $ResourceGroupName `
    --query "sort_by([?properties.provisioningState=='Succeeded'], &properties.timestamp)[-1].name" `
    --output tsv
}

if (-not $DeploymentName) {
  throw "No successful group deployment found in resource group '$ResourceGroupName'."
}

$deployment = az deployment group show `
  --resource-group $ResourceGroupName `
  --name $DeploymentName `
  --output json | ConvertFrom-Json

$outputs = $deployment.properties.outputs
$storageAccountName = $outputs.storageAccountName.value
$containerName = $outputs.documentsContainerName.value
$serviceBusNamespaceName = $outputs.serviceBusNamespaceName.value
$serviceBusTopicName = $outputs.serviceBusTopicName.value
$postgresServerHost = $outputs.postgresServerHost.value
$postgresDatabaseName = $outputs.postgresDatabaseName.value
$postgresAdminUser = $outputs.postgresAdminUser.value

$storageConnectionString = (az storage account show-connection-string `
  --resource-group $ResourceGroupName `
  --name $storageAccountName `
  --output json | ConvertFrom-Json).connectionString

$serviceBusConnectionString = (az servicebus namespace authorization-rule keys list `
  --resource-group $ResourceGroupName `
  --namespace-name $serviceBusNamespaceName `
  --name RootManageSharedAccessKey `
  --output json | ConvertFrom-Json).primaryConnectionString

$postgresUrl = "postgres://${postgresAdminUser}:$($env:AGENTOPS_POSTGRES_PASSWORD)@${postgresServerHost}:5432/${postgresDatabaseName}?sslmode=verify-full"

$lines = @(
  "NODE_ENV=production",
  "DATA_STORE=postgres",
  "POSTGRES_URL=$postgresUrl",
  "DOCUMENT_STORAGE=azure-blob",
  "AZURE_STORAGE_CONNECTION_STRING=$storageConnectionString",
  "AZURE_STORAGE_CONTAINER=$containerName",
  "OUTBOX_PUBLISHER=servicebus",
  "AZURE_SERVICE_BUS_CONNECTION_STRING=$serviceBusConnectionString",
  "AZURE_SERVICE_BUS_TOPIC=$serviceBusTopicName",
  "VECTOR_STORE=qdrant",
  "QDRANT_URL=http://qdrant:6333",
  "QDRANT_COLLECTION=agentops_documents",
  "LLM_PROVIDER=litellm",
  "LITELLM_BASE_URL=http://litellm:4000",
  "LITELLM_MODEL=azure-gpt-4o-mini",
  "SEED_DEMO_DATA=false"
)

$resolvedOutputPath = Join-Path (Resolve-Path -Path ".") $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutputPath

if (-not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$lines | Set-Content -Path $resolvedOutputPath -Encoding utf8
Write-Host "Generated $OutputPath. Keep this file local because it contains connection strings."
