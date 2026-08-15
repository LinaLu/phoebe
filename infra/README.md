# Phoebe infrastructure (Pulumi)

Deploys Phoebe to Google Cloud Run with Neon Postgres and HTTP Basic Auth on the frontend.

## Prerequisites

- `gcloud` authenticated (`gcloud auth login` and `gcloud auth application-default login`)
- `pulumi` CLI
- `podman` machine running
- Neon API key: `export NEON_API_KEY=...`
- Optional Neon org: `pulumi config set neonOrgId <org-id>`

## First-time setup

```bash
# Create a GCS bucket for state (once):
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/<deployer-key>.json
gcloud storage buckets create gs://<your-pulumi-state-bucket> \
  --project=<your-gcp-project-id> --location=<region> --uniform-bucket-level-access

# Point Pulumi at the bucket (not Pulumi Cloud)
pulumi login gs://<your-pulumi-state-bucket>

cd infra
bun install
pulumi stack init prod   # or: pulumi stack select prod
pulumi config set gcp:project <your-gcp-project-id>
pulumi config set gcp:region <region>
pulumi config set phoebe:neonRegion <neon-region>
pulumi config set phoebe:basicAuthUsername <username>
export NEON_API_KEY=...  # required by @pulumi/neon
# optional:
# pulumi config set neonOrgId YOUR_NEON_ORG_ID
# pulumi config set phoebe:serverImageTag v1.0.0
# pulumi config set phoebe:clientImageTag v1.0.0
# pulumi config set --secret basicAuthPassword 'your-password'

# Non-interactive runs need the stack passphrase:
# export PULUMI_CONFIG_PASSPHRASE=...

pulumi up
```

Pulumi **creates** a Neon project named `phoebe-<stack>` (e.g. `phoebe-prod`). Do not import or reuse a console-created project with a different name.

After deploy, open the exported `clientUrl` and sign in with the exported basic-auth credentials.
