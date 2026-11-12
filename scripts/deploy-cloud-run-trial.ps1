# This script pushes an image and deploys billable resources. Run only within
# the trial scope approved in docs/cloud-run-trial.md. It does not build images.
param([string]$LocalImage = 'jw-erp-trial:20261019-1')
$ErrorActionPreference = 'Stop'
$trialProject = 'jw-system-f2104'
$trialRegion = 'asia-southeast1'
$trialService = 'jw-erp-trial'
$trialImage = "$trialRegion-docker.pkg.dev/$trialProject/cloud-run-source-deploy/${trialService}:20261019-1"
& docker image inspect $LocalImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Build and verify the local image before deploying.' }
& docker tag $LocalImage $trialImage
if ($LASTEXITCODE -ne 0) { throw 'Unable to tag image.' }
& docker push $trialImage
if ($LASTEXITCODE -ne 0) { throw 'Image push failed; no deployment attempted.' }
& gcloud run deploy $trialService `
    --project=$trialProject --region=$trialRegion --platform=managed `
    --image=$trialImage --port=8080 `
    --cpu=1 --memory=1Gi --min=0 --max=1 --max-instances=1 `
    --concurrency=20 --timeout=60 --cpu-throttling --no-cpu-boost `
    --service-account="jw-erp-trial@$trialProject.iam.gserviceaccount.com" `
    --set-env-vars='CLOUD_RUN_BUILD=1,FIREBASE_ADMIN_PROJECT_ID=e-commerce-72a4b,FIREBASE_ADMIN_SERVICE_ACCOUNT_ID=jw-erp-trial@e-commerce-72a4b.iam.gserviceaccount.com' `
    --allow-unauthenticated --ingress=all --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run deployment failed; inspect service status before retrying.' }
& gcloud run services describe $trialService --project=$trialProject --region=$trialRegion `
    --format='json(status.url,status.latestReadyRevisionName,status.conditions)' --quiet
if ($LASTEXITCODE -ne 0) { throw 'Unable to verify Cloud Run service readiness.' }
