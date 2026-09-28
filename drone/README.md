# Drone CI Setup & Configuration Guide

This guide explains how to start and operate Drone Server and the Drone Docker Runner for automated CI/CD with Minikube.

---

## Architecture

```
GitHub Push / Webhook
         │
         ▼
    Drone Server (:8000)
         │
         ▼ (RPC Secret)
Drone Docker Runner
         │
         ├── Attached to 'minikube' Docker network
         ├── Step 1: Backend Tests (node:20-alpine)
         ├── Step 2: Frontend Build (node:20-alpine)
         ├── Step 3: Docker Build & Push (plugins/docker)
         └── Step 4: Kubernetes Rolling Deployment (bitnami/kubectl)
                   │
                   ▼ (Target: https://minikube:8443)
               Minikube Cluster (k8s-demo)
```

---

## 1. Webhook Tunnel Process (Cloudflare Tunnel / ngrok)

### Why is a Tunnel Required?
1. **The Problem**: Drone Server runs locally on your development machine (`http://localhost:8000`). When you push code to GitHub, GitHub's public cloud servers must notify Drone by sending an HTTP POST webhook request. However, GitHub cannot reach `localhost` or private local IP addresses behind NAT/firewalls.
2. **The Solution**: A secure public reverse proxy tunnel (e.g. **Cloudflare Tunnel** or **ngrok**) exposes your local port `8000` to a public HTTPS URL accessible by GitHub.

```
┌──────────────┐   git push    ┌──────────────┐
│  Developer   │ ────────────> │ GitHub Cloud │
└──────────────┘               └──────┬───────┘
                                      │ POST Webhook (https://<tunnel-domain>/hook)
                                      ▼
                        ┌───────────────────────────┐
                        │   Cloudflare / ngrok Edge │
                        └─────────────┬─────────────┘
                                      │ Encrypted Egress Tunnel
                                      ▼
                        ┌───────────────────────────┐
                        │ cloudflared / ngrok agent │
                        └─────────────┬─────────────┘
                                      │ http://localhost:8000
                                      ▼
                        ┌───────────────────────────┐
                        │ Drone Server (Port 8000)  │
                        └───────────────────────────┘
```

---

### Step-by-Step Tunnel Setup

#### Option A: Cloudflare Tunnel (Recommended — Free & No Account Needed)
1. Download `cloudflared` (or install via `winget install --id Cloudflare.cloudflared`).
2. Start the tunnel forwarding to Drone Server (port 8000):
   ```powershell
   cloudflared tunnel --url http://localhost:8000
   ```
3. Look for the assigned public tunnel URL in the console output:
   ```text
   +--------------------------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
   |  https://creates-aid-dts-flowers.trycloudflare.com                                         |
   +--------------------------------------------------------------------------------------------+
   ```
4. **Keep this terminal window open** while developing or running CI/CD.

#### Option B: ngrok (Alternative)
1. Start ngrok on port 8000:
   ```powershell
   ngrok http 8000
   ```
2. Copy the forwarding HTTPS address (e.g. `https://your-subdomain.ngrok-free.app`).

---

### Syncing the Tunnel with Drone and GitHub

Whenever your tunnel URL changes (or on first setup), configure these 3 locations:

1. **Update `drone/.env`**:
   ```ini
   # Strip 'https://' from the host string
   DRONE_SERVER_HOST=creates-aid-dts-flowers.trycloudflare.com
   DRONE_SERVER_PROTO=https
   ```
2. **Update GitHub OAuth App** (`GitHub -> Settings -> Developer settings -> OAuth Apps`):
   - **Homepage URL**: `https://creates-aid-dts-flowers.trycloudflare.com`
   - **Authorization callback URL**: `https://creates-aid-dts-flowers.trycloudflare.com/login`
3. **Verify / Update GitHub Webhook** (`Repository -> Settings -> Webhooks`):
   - **Payload URL**: `https://creates-aid-dts-flowers.trycloudflare.com/hook`
   - **Content type**: `application/json`
   - **Events**: *Pushes*

4. **Restart Drone Containers**:
   ```powershell
   cd drone
   docker compose down
   docker compose up -d
   ```

---

## 2. Create GitHub OAuth Application

1. Go to **GitHub** $\rightarrow$ **Settings** $\rightarrow$ **Developer settings** $\rightarrow$ **OAuth Apps** $\rightarrow$ **New OAuth App**.
2. Fill in the fields:
   - **Application name**: `Drone CI Local`
   - **Homepage URL**: `https://<your-tunnel-host>` (e.g. `https://creates-aid-dts-flowers.trycloudflare.com`)
   - **Authorization callback URL**:
     ```
     https://<your-tunnel-host>/login
     ```
     *(Must match `DRONE_SERVER_PROTO` and `DRONE_SERVER_HOST` exactly)*
3. Click **Register application**.
4. Generate a **Client Secret** and copy both the **Client ID** and **Client Secret**.

---

## 3. Configure Environment (`drone/.env`)

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item drone/.env.example drone/.env
   ```
2. Generate an RPC secret:
   ```powershell
   # In PowerShell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
3. Update `drone/.env`:
   ```ini
   DRONE_GITHUB_CLIENT_ID=<your-github-client-id>
   DRONE_GITHUB_CLIENT_SECRET=<your-github-client-secret>
   DRONE_RPC_SECRET=<your-generated-rpc-secret>
   DRONE_SERVER_HOST=creates-aid-dts-flowers.trycloudflare.com
   DRONE_SERVER_PROTO=https
   DRONE_ADMIN_USER=<your-github-username>
   ```

---

## 4. Start Drone Infrastructure

From the `drone/` directory:

```powershell
cd drone
docker compose up -d
```

Verify containers are running:
```powershell
docker ps --filter "name=drone"
```

Verify server and runner logs:
```powershell
docker logs drone-server
docker logs drone-runner
```
*The runner log should show:* `successfully pinged the remote server`.

---

## 5. Drone Repository Secrets

Once logged into Drone UI (`https://<your-tunnel-domain>` or `http://localhost:8000`):
1. Navigate to your repository $\rightarrow$ **Settings** $\rightarrow$ **Secrets**.
2. Add the following secrets:

| Secret Name | Value Description |
|---|---|
| `docker_username` | Your Docker Hub account username (e.g. `omkarvbhoir`) |
| `docker_password` | Your Docker Hub personal access token (Read & Write) |
| `k8s_token` | The ServiceAccount token generated in `k8s-demo` |

To obtain the `k8s_token` on Windows:
```powershell
kubectl get secret drone-deployer-token -n k8s-demo -o go-template="{{.data.token | base64decode}}"
```

---

## 6. College Viva Questions & Answers

**Q1: What is the difference between a Deployment and a ReplicaSet?**  
> A ReplicaSet ensures that a specified number of Pod replicas are running at any given time. A Deployment is a higher-level abstraction that manages ReplicaSets, enabling declarative updates, rollouts, rollbacks, and zero-downtime rolling deployments.

**Q2: What is the difference between a Liveness Probe and a Readiness Probe?**  
> A Liveness Probe determines if a container needs to be restarted (e.g. if the process is stuck or in an unrecoverable state). A Readiness Probe determines if the container is ready to accept user traffic; if it fails, the Pod's IP is temporarily removed from the Service endpoints without killing the container.

**Q3: How does Kubernetes Self-Healing work?**  
> Kubernetes continuously compares the **Desired State** (declared in YAML, e.g. 3 replicas) with the **Actual State** (observed in the cluster). If a node crashes or a Pod terminates, the ReplicaSet controller detects the discrepancy (`Desired > Actual`) and schedules replacement Pods immediately.

**Q4: Why use multi-stage Docker builds for the React frontend?**  
> Multi-stage builds separate the build environment from the production runtime. The Node.js SDK and Vite build dependencies (~300MB) are discarded after compiling static files, leaving only a lean NGINX Alpine runtime (~26MB). This dramatically reduces image size and attack surface.

**Q5: Why use deterministic build tags (`${DRONE_BUILD_NUMBER}`) instead of `latest`?**  
> The `latest` tag is mutable. If an image is updated under `latest`, Kubernetes may not trigger a rollout because the image string didn't change (`imagePullPolicy: IfNotPresent`). Using versioned tags (e.g. `v42`) guarantees immutable, traceable releases, enables clean rollouts, and allows instant rollbacks.

**Q6: What is the purpose of Kubernetes Ingress?**  
> Ingress acts as an intelligent HTTP/HTTPS reverse proxy and edge router. Instead of exposing multiple public IP addresses or NodePorts for each microservice, a single Ingress controller routes traffic based on URL paths (`/` $\rightarrow$ frontend, `/api` $\rightarrow$ backend).

**Q7: Why is a tunnel (Cloudflare Tunnel / ngrok) necessary for Drone CI?**  
> Drone runs on a local machine behind NAT and firewalls. GitHub's cloud servers need to trigger pipelines by posting webhooks. Without a public reverse proxy tunnel providing a publicly resolvable HTTPS URL, GitHub cannot reach `localhost:8000`.