import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";
import * as command from "@pulumi/command";
import * as neon from "@pulumi/neon";
import * as path from "path";
const config = new pulumi.Config();
const gcpConfig = new pulumi.Config("gcp");

const project = gcpConfig.require("project");
const region = gcpConfig.require("region");
const neonOrgId = config.get("neonOrgId"); // optional but recommended
const neonRegion = config.require("neonRegion");

// ---------------------------------------------------------------------------
// Secrets / credentials
// ---------------------------------------------------------------------------
// Prefer an explicit secret from config; otherwise generate one.
const configuredBasicAuthPassword = config.getSecret("basicAuthPassword");
const generatedBasicAuthPassword = new random.RandomPassword("basic-auth-password", {
  length: 24,
  special: false,
}).result;
const basicAuthPassword = configuredBasicAuthPassword ?? generatedBasicAuthPassword;

const basicAuthUsername = config.require("basicAuthUsername");

// Shared internal authentication key between client reverse proxy and backend API
const internalApiKey = new random.RandomPassword("internal-api-key", {
  length: 32,
  special: false,
}).result;

// ---------------------------------------------------------------------------
// Neon Serverless Postgres
// ---------------------------------------------------------------------------
const neonProject = new neon.Project("phoebe", {
  name: `phoebe-${pulumi.getStack()}`,
  pgVersion: 16,
  regionId: neonRegion,
  ...(neonOrgId ? { orgId: neonOrgId } : {}),
  branch: {
    name: "main",
    databaseName: "phoebe_db",
    roleName: "phoebe",
  },
  defaultEndpointSettings: {
    autoscalingLimitMinCu: 0.25,
    autoscalingLimitMaxCu: 1.0,
  },
  historyRetentionSeconds: 21600, // free tier max (6h)
});

// Prefer pooled connection string for serverless Cloud Run
const databaseUrl = neonProject.connectionUriPooler.apply((uri) => {
  if (!uri) {
    throw new Error("Neon connection URI pooler is empty");
  }
  // Ensure sslmode is set for Cloud Run / Neon
  if (uri.includes("sslmode=")) return uri;
  return uri.includes("?") ? `${uri}&sslmode=require` : `${uri}?sslmode=require`;
});

// ---------------------------------------------------------------------------
// Artifact Registry
// ---------------------------------------------------------------------------
const repository = new gcp.artifactregistry.Repository("phoebe", {
  repositoryId: "phoebe",
  location: region,
  format: "DOCKER",
  description: "Phoebe container images",
});

const repoRoot = path.resolve(process.cwd(), "..");
const clientPackage = require(path.join(repoRoot, "client", "package.json"));
const serverPackage = require(path.join(repoRoot, "server", "package.json"));

const serverImageTag = config.get("serverImageTag") ?? `v${serverPackage.version}`;
const clientImageTag = config.get("clientImageTag") ?? `v${clientPackage.version}`;

const registryHost = pulumi.interpolate`${region}-docker.pkg.dev`;
const serverImageName = pulumi.interpolate`${registryHost}/${project}/${repository.repositoryId}/server:${serverImageTag}`;
const clientImageName = pulumi.interpolate`${registryHost}/${project}/${repository.repositoryId}/client:${clientImageTag}`;

// ---------------------------------------------------------------------------
// Build & push images with Podman (project requires Podman, not Docker)
// ---------------------------------------------------------------------------

const enableApis = [
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "iam.googleapis.com",
  "cloudbuild.googleapis.com",
].map(
  (svc) =>
    new gcp.projects.Service(`enable-${svc.split(".")[0]}`, {
      service: svc,
      disableOnDestroy: false,
    }),
);

// Configure podman/docker auth for Artifact Registry via gcloud helper
const registryLogin = new command.local.Command(
  "artifact-registry-login",
  {
    // Configures docker/podman credential helper for Artifact Registry.
    create: pulumi.interpolate`gcloud auth configure-docker ${registryHost} --quiet && podman login -u oauth2accesstoken -p "$(gcloud auth print-access-token)" ${registryHost}`,
    triggers: [repository.id, Date.now().toString()],
  },
  { dependsOn: [repository, ...enableApis] },
);

// Cloud Run requires linux/amd64; local Podman on Apple Silicon defaults to arm64.
const buildPlatform = "linux/amd64";

const buildServerImage = new command.local.Command(
  "build-server-image",
  {
    create: pulumi.interpolate`podman build --platform ${buildPlatform} -f server/Containerfile -t ${serverImageName} . && podman push ${serverImageName}`,
    dir: repoRoot,
    triggers: [serverImageTag, repository.id, buildPlatform],
  },
  { dependsOn: [registryLogin] },
);

const buildClientImage = new command.local.Command(
  "build-client-image",
  {
    create: pulumi.interpolate`podman build --platform ${buildPlatform} -f client/Containerfile -t ${clientImageName} . && podman push ${clientImageName}`,
    dir: repoRoot,
    triggers: [clientImageTag, repository.id, buildPlatform],
  },
  { dependsOn: [registryLogin] },
);

// ---------------------------------------------------------------------------
// Cloud Run service account
// ---------------------------------------------------------------------------
const runtimeSa = new gcp.serviceaccount.Account("phoebe-runtime", {
  accountId: `phoebe-runtime-${pulumi.getStack()}`.slice(0, 30),
  displayName: "Phoebe Cloud Run runtime",
});

new gcp.artifactregistry.RepositoryIamMember("runtime-ar-reader", {
  repository: repository.id,
  role: "roles/artifactregistry.reader",
  member: pulumi.interpolate`serviceAccount:${runtimeSa.email}`,
});

// ---------------------------------------------------------------------------
// Cloud Run — Server
// ---------------------------------------------------------------------------
const serverService = new gcp.cloudrunv2.Service(
  "server",
  {
    name: `phoebe-server-${pulumi.getStack()}`,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    template: {
      serviceAccount: runtimeSa.email,
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 3,
      },
      containers: [
        {
          image: serverImageName,
          ports: { containerPort: 3000 },
          envs: [
            { name: "DATABASE_URL", value: databaseUrl },
            { name: "INTERNAL_API_KEY", value: internalApiKey },
          ],
          resources: {
            limits: {
              cpu: "1",
              memory: "512Mi",
            },
          },
          startupProbe: {
            httpGet: { path: "/health", port: 3000 },
            periodSeconds: 5,
            failureThreshold: 12,
          },
          livenessProbe: {
            httpGet: { path: "/health", port: 3000 },
            periodSeconds: 30,
          },
        },
      ],
      timeout: "60s",
      maxInstanceRequestConcurrency: 80,
    },
  },
  { dependsOn: [buildServerImage, ...enableApis] },
);

// Allow the client (and optional direct API access) to invoke the server.
// Server stays public at the Cloud Run layer; app auth can be added later.
new gcp.cloudrunv2.ServiceIamMember("server-invoker", {
  name: serverService.name,
  location: region,
  role: "roles/run.invoker",
  member: "allUsers",
});

const serverUrl = serverService.uri;

// ---------------------------------------------------------------------------
// Cloud Run Job — Drizzle migrations
// ---------------------------------------------------------------------------
const migrateJob = new gcp.cloudrunv2.Job(
  "migrate",
  {
    name: `phoebe-migrate-${pulumi.getStack()}`,
    location: region,
    template: {
      template: {
        serviceAccount: runtimeSa.email,
        containers: [
          {
            image: serverImageName,
            commands: ["bun", "run", "db:migrate"],
            envs: [
              { name: "DATABASE_URL", value: databaseUrl },
            ],
            resources: {
              limits: {
                cpu: "1",
                memory: "512Mi",
              },
            },
          },
        ],
        timeout: "300s",
        maxRetries: 1,
      },
    },
  },
  { dependsOn: [buildServerImage, neonProject, ...enableApis] },
);

// Execute migrations after job is created / image updated
const runMigrations = new command.local.Command(
  "run-migrations",
  {
    create: pulumi.interpolate`gcloud run jobs execute ${migrateJob.name} --region=${region} --project=${project} --wait`,
    triggers: [serverImageTag, databaseUrl],
  },
  { dependsOn: [migrateJob] },
);

// ---------------------------------------------------------------------------
// Cloud Run — Client (Nginx + Basic Auth)
// ---------------------------------------------------------------------------
const clientService = new gcp.cloudrunv2.Service(
  "client",
  {
    name: `phoebe-client-${pulumi.getStack()}`,
    location: region,
    ingress: "INGRESS_TRAFFIC_ALL",
    template: {
      serviceAccount: runtimeSa.email,
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 3,
      },
      containers: [
        {
          image: clientImageName,
          ports: { containerPort: 80 },
          envs: [
            { name: "SERVER_URL", value: serverUrl },
            { name: "INTERNAL_API_KEY", value: internalApiKey },
            { name: "BASIC_AUTH_USERNAME", value: basicAuthUsername },
            { name: "BASIC_AUTH_PASSWORD", value: basicAuthPassword },
            // nginx docker entrypoint only substitutes listed vars by default
            { name: "NGINX_ENVSUBST_FILTER", value: "SERVER_URL|INTERNAL_API_KEY" },
          ],
          resources: {
            limits: {
              cpu: "1",
              memory: "512Mi",
            },
          },
        },
      ],
      timeout: "60s",
      maxInstanceRequestConcurrency: 80,
    },
  },
  { dependsOn: [buildClientImage, serverService, ...enableApis] },
);

new gcp.cloudrunv2.ServiceIamMember("client-invoker", {
  name: clientService.name,
  location: region,
  role: "roles/run.invoker",
  member: "allUsers",
});

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
export const clientUrl = clientService.uri;
export const apiUrl = serverService.uri;
export const neonProjectId = neonProject.id;
export const artifactRegistry = pulumi.interpolate`${registryHost}/${project}/${repository.repositoryId}`;
export const basicAuthUser = basicAuthUsername;
export const basicAuthPass = pulumi.secret(basicAuthPassword);
export const migrateJobName = migrateJob.name;
export const serverTag = serverImageTag;
export const clientTag = clientImageTag;
