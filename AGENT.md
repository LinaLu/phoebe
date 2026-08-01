## Project

**Phoebe** is a zero-knowledge encrypted family medical records vault and command system.

## Architecture & Tech Stack

The application is structured as a 3-tier architecture with end-to-end client-side encryption.

- **Frontend**: `client/` — React (Vite Web PWA) + React Native (Expo Mobile) + Tailwind CSS using Bun.
- **Backend**: `server/` — TypeScript with Hono API framework running on Bun.
- **Database**: PostgreSQL managed via Drizzle ORM.
- **Cloud & Deployment**: GCP Cloud Run (containers), GCP Cloud Storage (encrypted blobs), GCP Secret Manager.
- **Containerization & Tooling**: Podman (strict replacement for Docker; do NOT use `docker`).
- **Security & E2EE**: All medical record payloads and files are encrypted client-side via Web Crypto / Expo Crypto before reaching the backend API.
- **Testing**: 
  - Unit & Integration tests: Bun test runner (`bun test`). Run `bun test` from the root directory to execute the full unit test suite across client and server packages.
  - End-to-End E2E tests: Playwright.

## Container & Podman Guidelines

- All container operations MUST use **Podman** exclusively (e.g., `podman build`, `podman run`, `podman-compose`). Do NOT invoke `docker`.
- When building backend deployment images for GCP Cloud Run, use Podman target builds (e.g., `podman build -t gcr.io/YOUR_PROJECT/phoebe-api ./server`).

## GitHub Operations

- All `gh` operations MUST be prefixed with `GH_CONFIG_DIR=../.config/gh_auth` and with parameter `--repo LinaLu/phoebe` (e.g. `GH_CONFIG_DIR=../.config/gh_auth gh pr create --repo LinaLu/phoebe`).
- Pull Requests should be created using `gh` with a lean, concise description.

