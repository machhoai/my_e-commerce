# Creates billable resources. Do not run before approval of the bridge cost scope.
param(
    [Parameter(Mandatory = $true)][string]$ApiKeyFile,
    [Parameter(Mandatory = $true)][string]$RuntimeEnvFile,
    [string]$ImageTag = '20261020-1',
    [string]$LocalImage = 'jw-zkteco-bridge:20261020-1'
)
$ErrorActionPreference = 'Stop'
$bridgeProject = 'jw-system-f2104'
$bridgeRegion = 'asia-southeast1'
$bridgeService = 'jw-zkteco-bridge'
$bridgeIdentity = "$bridgeService@$bridgeProject.iam.gserviceaccount.com"
$bridgeSecret = 'jw-zkteco-bridge-api-key'
$bridgeImage = "$bridgeRegion-docker.pkg.dev/$bridgeProject/cloud-run-source-deploy/${bridgeService}:$ImageTag"
foreach ($requiredFile in @($ApiKeyFile, $RuntimeEnvFile)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw 'Missing private deployment input file.' }
}
if ([System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $ApiKeyFile)).Trim().Length -lt 32) {
    throw 'Use an API key of at least 32 characters.'
}
$runtimeConfiguration = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $RuntimeEnvFile))
if ($runtimeConfiguration -match '(?m)^\s*ZK_API_KEY\s*:') { throw 'Keep the API key in Secret Manager, outside the runtime YAML.' }
if ($runtimeConfiguration -notmatch '(?m)^\s*ZK_(DEVICE_HOST|DEVICES_JSON)\s*:') { throw 'Specify the confirmed device configuration.' }
if ($runtimeConfiguration -notmatch '(?m)^\s*ZK_ALLOW_WRITES:\s*"?false"?\s*$') { throw 'This trial requires ZK_ALLOW_WRITES=false.' }
# Deploy the image already built and tested locally; do not rebuild on the cloud.
& docker image inspect $LocalImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Build and verify the local image first.' }
& docker tag $LocalImage $bridgeImage
if ($LASTEXITCODE -ne 0) { throw 'Cannot tag the local image.' }
& gcloud iam service-accounts create $bridgeService --project=$bridgeProject --display-name='ZKTeco bridge runtime' --quiet
if ($LASTEXITCODE -ne 0) { throw 'Service account creation failed. Inspect before retrying.' }
& gcloud secrets create $bridgeSecret --project=$bridgeProject --replication-policy=automatic --data-file=$ApiKeyFile --quiet
if ($LASTEXITCODE -ne 0) { throw 'Secret creation failed. Inspect before retrying.' }
& gcloud secrets add-iam-policy-binding $bridgeSecret --project=$bridgeProject --member="serviceAccount:$bridgeIdentity" --role=roles/secretmanager.secretAccessor --quiet --format='value(etag)'
if ($LASTEXITCODE -ne 0) { throw 'Secret access grant failed.' }
& docker push $bridgeImage
if ($LASTEXITCODE -ne 0) { throw 'Image push failed.' }
& gcloud run deploy $bridgeService --project=$bridgeProject --region=$bridgeRegion --platform=managed `
    --image=$bridgeImage --port=8080 --cpu=1 --memory=512Mi --min=0 --max=1 --max-instances=1 `
    --concurrency=1 --timeout=60 --cpu-throttling --no-cpu-boost `
    --service-account=$bridgeIdentity --env-vars-file=$RuntimeEnvFile `
    --set-secrets="ZK_API_KEY=${bridgeSecret}:1" --allow-unauthenticated --ingress=all --quiet
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Inspect before retrying.' }
& gcloud run services describe $bridgeService --project=$bridgeProject --region=$bridgeRegion `
    --format='json(status.url,status.latestReadyRevisionName,status.conditions)' --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify service readiness.' }
