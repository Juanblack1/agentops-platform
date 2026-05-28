param(
  [Parameter(Mandatory = $false)]
  [string] $ResourceGroupName = "rg-agentops-br-dev",

  [Parameter(Mandatory = $false)]
  [string] $BudgetName = "agentops-dev-guardrail",

  [Parameter(Mandatory = $false)]
  [decimal] $Amount = 100,

  [Parameter(Mandatory = $false)]
  [string] $ContactEmail = ""
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not $ContactEmail) {
  $ContactEmail = az account show --query user.name --output tsv
}

$today = Get-Date
$startDate = Get-Date -Year $today.Year -Month $today.Month -Day 1 -Hour 0 -Minute 0 -Second 0
$endDate = $startDate.AddYears(1)

$notifications = @{
  actual50 = @{
    enabled = $true
    operator = "GreaterThanOrEqualTo"
    threshold = 50
    "contact-emails" = @($ContactEmail)
  }
  actual80 = @{
    enabled = $true
    operator = "GreaterThanOrEqualTo"
    threshold = 80
    "contact-emails" = @($ContactEmail)
  }
  actual100 = @{
    enabled = $true
    operator = "GreaterThanOrEqualTo"
    threshold = 100
    "contact-emails" = @($ContactEmail)
  }
} | ConvertTo-Json -Depth 10

$period = @{
  "start-date" = $startDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  "end-date" = $endDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

$notificationsFile = New-TemporaryFile
$periodFile = New-TemporaryFile

try {
  Set-Content -LiteralPath $notificationsFile -Value $notifications -Encoding utf8
  Set-Content -LiteralPath $periodFile -Value $period -Encoding utf8

  az consumption budget create-with-rg `
    --resource-group $ResourceGroupName `
    --budget-name $BudgetName `
    --amount $Amount `
    --category Cost `
    --time-grain Monthly `
    --time-period "@$periodFile" `
    --notifications "@$notificationsFile" `
    --output table
} finally {
  Remove-Item -LiteralPath $notificationsFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $periodFile -Force -ErrorAction SilentlyContinue
}
