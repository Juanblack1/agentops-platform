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

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI was not found. Install and start Docker Desktop before using this fallback."
}

$loginServer = az acr show `
  --name $RegistryName `
  --query loginServer `
  --output tsv

if ($LASTEXITCODE -ne 0 -or -not $loginServer) {
  throw "Could not resolve ACR login server for '$RegistryName'."
}

az acr login --name $RegistryName

if ($LASTEXITCODE -ne 0) {
  throw "Could not log in to Azure Container Registry '$RegistryName'."
}

$backendImage = "$loginServer/agentops/backend:$ImageTag"
$frontendImage = "$loginServer/agentops/frontend:$ImageTag"

docker build -f backend/Dockerfile -t $backendImage .
if ($LASTEXITCODE -ne 0) {
  throw "Local Docker backend image build failed."
}

docker build -f frontend/Dockerfile --build-arg "VITE_API_BASE_URL=$FrontendApiBaseUrl" -t $frontendImage .
if ($LASTEXITCODE -ne 0) {
  throw "Local Docker frontend image build failed."
}

docker push $backendImage
if ($LASTEXITCODE -ne 0) {
  throw "Backend image push failed."
}

docker push $frontendImage
if ($LASTEXITCODE -ne 0) {
  throw "Frontend image push failed."
}

Write-Host "Published images:"
Write-Host $backendImage
Write-Host $frontendImage
