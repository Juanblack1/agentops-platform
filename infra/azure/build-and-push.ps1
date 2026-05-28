param(
  [Parameter(Mandatory = $true)]
  [string] $RegistryName,

  [Parameter(Mandatory = $false)]
  [string] $ImageTag = "",

  [Parameter(Mandatory = $false)]
  [string] $FrontendApiBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not $ImageTag) {
  $ImageTag = Get-Date -Format "yyyyMMddHHmmss"
}

az acr build `
  --registry $RegistryName `
  --image "agentops/backend:$ImageTag" `
  --file "backend/Dockerfile" `
  "."

if ($LASTEXITCODE -ne 0) {
  throw "Backend image build failed in Azure Container Registry."
}

az acr build `
  --registry $RegistryName `
  --image "agentops/frontend:$ImageTag" `
  --build-arg "VITE_API_BASE_URL=$FrontendApiBaseUrl" `
  --file "frontend/Dockerfile" `
  "."

if ($LASTEXITCODE -ne 0) {
  throw "Frontend image build failed in Azure Container Registry."
}

Write-Host "Published images:"
Write-Host "$RegistryName.azurecr.io/agentops/backend:$ImageTag"
Write-Host "$RegistryName.azurecr.io/agentops/frontend:$ImageTag"
