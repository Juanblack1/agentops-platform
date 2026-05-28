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

$contextDir = Join-Path ([System.IO.Path]::GetTempPath()) "agentops-acr-build-$([guid]::NewGuid().ToString("N"))"
New-Item -ItemType Directory -Force -Path $contextDir | Out-Null

function Copy-IfExists([string] $Path, [string] $Destination) {
  if (Test-Path -LiteralPath $Path) {
    Copy-Item -LiteralPath $Path -Destination $Destination -Recurse -Force
  }
}

try {
  Copy-IfExists "package.json" $contextDir
  Copy-IfExists "package-lock.json" $contextDir

  $backendContext = Join-Path $contextDir "backend"
  New-Item -ItemType Directory -Force -Path $backendContext | Out-Null
  foreach ($item in @("package.json", "tsconfig.json", "Dockerfile", "src", "mastra", "migrations", "scripts")) {
    Copy-IfExists (Join-Path "backend" $item) $backendContext
  }

  $frontendContext = Join-Path $contextDir "frontend"
  New-Item -ItemType Directory -Force -Path $frontendContext | Out-Null
  foreach ($item in @("package.json", "tsconfig.json", "vite.config.ts", "index.html", "Dockerfile", "nginx.conf", "src")) {
    Copy-IfExists (Join-Path "frontend" $item) $frontendContext
  }

az acr build `
  --registry $RegistryName `
  --image "agentops/backend:$ImageTag" `
  --file "backend/Dockerfile" `
    $contextDir

if ($LASTEXITCODE -ne 0) {
  throw "Backend image build failed in Azure Container Registry."
}

az acr build `
  --registry $RegistryName `
  --image "agentops/frontend:$ImageTag" `
  --build-arg "VITE_API_BASE_URL=$FrontendApiBaseUrl" `
  --file "frontend/Dockerfile" `
    $contextDir

if ($LASTEXITCODE -ne 0) {
  throw "Frontend image build failed in Azure Container Registry."
}

Write-Host "Published images:"
Write-Host "$RegistryName.azurecr.io/agentops/backend:$ImageTag"
Write-Host "$RegistryName.azurecr.io/agentops/frontend:$ImageTag"
} finally {
  Remove-Item -LiteralPath $contextDir -Recurse -Force -ErrorAction SilentlyContinue
}
