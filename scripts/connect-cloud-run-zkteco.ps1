# Approved production connection scope is recorded in docs/zkteco-cloud-run-migration.md.
# Creates a ready candidate without moving production traffic. Decide promotion
# separately after checks and operator confirmation; report hardware status independently.
param([string]$LocalImage = 'jw-erp-trial:20261020-bridge1')
$ErrorActionPreference = 'Stop'
$connectionProject = 'jw-system-f2104'
$connectionRegion = 'asia-southeast1'
$connectionService = 'jw-erp-trial'
$connectionImage = "$connectionRegion-docker.pkg.dev/$connectionProject/cloud-run-source-deploy/${connectionService}:20261020-bridge1"
$connectionEndpoint = 'https://jw-zkteco-bridge-cxwygwr7wa-as.a.run.app'

$existingService = (& gcloud run services describe $connectionService --project=$connectionProject --region=$connectionRegion --format=json --quiet | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing ERP service.' }
if ($existingService.status.latestReadyRevisionName -ne 'jw-erp-trial-00001-58p') {
    throw 'ERP revision changed since planning. Inspect before deploying.'
}
if ($existingService.spec.template.spec.serviceAccountName -ne 'jw-erp-trial@jw-system-f2104.iam.gserviceaccount.com') {
    throw 'Unexpected ERP runtime identity.'
}
& docker image inspect $LocalImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Build and verify the local image first.' }
& docker tag $LocalImage $connectionImage
if ($LASTEXITCODE -ne 0) { throw 'Cannot tag ERP image.' }
& docker push $connectionImage
if ($LASTEXITCODE -ne 0) { throw 'Image push failed; ERP was not changed.' }

# Update only these runtime settings; retain existing Firebase settings,
# identity, scaling, ingress, timeout, resources and custom domain mappings.
& gcloud run services update $connectionService --project=$connectionProject --region=$connectionRegion `
    --image=$connectionImage `
    --update-env-vars="ZKTECO_WORKER_URL=$connectionEndpoint,ZKTECO_WORKER_URL_OVERRIDE=$connectionEndpoint,ZK_DEVICE_ID=store-01-zk" `
    --update-secrets='ZKTECO_API_KEY=jw-zkteco-bridge-api-key:1' `
    --no-traffic --tag=zkteco-ready --quiet
if ($LASTEXITCODE -ne 0) { throw 'ERP update failed. Inspect status before retrying.' }
& gcloud run services describe $connectionService --project=$connectionProject --region=$connectionRegion `
    --format='json(status.url,status.latestReadyRevisionName,status.conditions,status.traffic)' --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect deployment readiness.' }
