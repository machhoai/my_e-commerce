param(
    [string]$Image = 'jw-erp-trial:20261019-1',
    [string]$PublicEnvFile = '.env.local',
    [string]$SiteUrl = 'https://jw-erp-trial-107789134874.asia-southeast1.run.app'
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $PublicEnvFile
$publicNames = @(
    'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'NEXT_PUBLIC_COMPANY_DOMAIN'
)
$publicValues = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
    if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$') {
        $name = $Matches[1]
        if ($publicNames -notcontains $name) { continue }
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $publicValues[$name] = $value
    }
}
foreach ($required in $publicNames[0..5]) {
    if (-not $publicValues[$required]) { throw "Missing public build setting: $required" }
}
if ($publicValues['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] -ne 'e-commerce-72a4b') {
    throw 'Firebase project differs from the existing application data project.'
}
$dockerArguments = @('build', '--platform=linux/amd64', '--tag', $Image)
foreach ($name in $publicNames) {
    if ($publicValues.ContainsKey($name)) {
        $dockerArguments += @('--build-arg', "$name=$($publicValues[$name])")
    }
}
$dockerArguments += @('--build-arg', "NEXT_PUBLIC_SITE_URL=$SiteUrl", $repoRoot)
& docker @dockerArguments
if ($LASTEXITCODE -ne 0) { throw "Local Docker build failed with exit code $LASTEXITCODE" }
