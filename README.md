# Automated Application Deployment and Self-Healing using Kubernetes and CI/CD

A complete college-level DevOps engineering project demonstrating end-to-end continuous integration, continuous delivery (CI/CD), containerization, orchestration, self-healing, health monitoring, and automated rolling updates.

---

## CI/CD Status
Drone CI is configured for automated testing and continuous integration.

---

## 1. Architecture

### Comprehensive CI/CD and Orchestration Workflow
```
Developer
    │
    │ git push
    ▼
GitHub
    │
    │ webhook
    ▼
Drone Server (Port 8000)
    │
    ▼
Drone Docker Runner (Attached to 'minikube' network)
    │
    ├── Step 1: npm test (Node 20 Alpine)
    ├── Step 2: npm build (Node 20 Alpine)
    ├── Step 3: Docker build & push (backend:build-${DRONE_BUILD_NUMBER})
    └── Step 4: Docker build & push (frontend:build-${DRONE_BUILD_NUMBER})
              │
              ▼
        Docker Hub Registry
              │
              ▼
        Kubernetes API (https://minikube:8443)
              │
              ▼
     Minikube Cluster (Namespace: k8s-demo)
              │
       ┌──────┴──────┐
       ▼             ▼
   Frontend        Backend
    2 Pods          3 Pods
 (NGINX/React)   (Node/Express)
       │         (Liveness & Readiness Probes)
       │             │
       └──────┬──────┘
              ▼
       NGINX Ingress
              │
              ▼
       User Web Browser
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite | User dashboard displaying live status, pod names, and replica logs |
| **Backend** | Node.js + Express | Stateless microservice API (`/api/health`, `/api/info`) |
| **Containerization** | Docker | Multi-stage production container builds |
| **Container Registry** | Docker Hub | Remote storage of versioned image tags |
| **Orchestration** | Kubernetes (Minikube) | Clustering, self-healing, replication, and service discovery |
| **Ingress** | NGINX Ingress Controller | Edge routing (`/` $\rightarrow$ frontend, `/api` $\rightarrow$ backend) |
| **CI/CD Automation** | Drone CI (Server + Runner) | Pipeline automation triggered via GitHub push webhooks |
| **Version Control** | Git + GitHub | Source repository and webhook event emitter |

---

## 3. Local Development (Without Docker)

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Backend Server
```powershell
cd backend
npm install
npm test
npm start
```
- Listens on `http://0.0.0.0:5000`
- Configurable environment variables: `PORT` (default 5000), `APP_VERSION` (default `1.0.0`), `FAIL_HEALTH_CHECK` (default `false`).

### 2. Frontend Development Server
```powershell
cd frontend
npm install
npm run build
npm run dev
```
- Runs on `http://localhost:3000`
- Automatically proxies relative `/api/*` calls to `http://localhost:5000` during local dev.

---

## 4. Docker Containerization

### Backend Dockerfile (`backend/Dockerfile`)
- Official `node:20-alpine` base.
- Production-only dependencies: `npm ci --omit=dev`.
- Runs as unprivileged `node` user for security.
- Dynamically resolves container hostname and downward API pod identity.

### Frontend Dockerfile (`frontend/Dockerfile`)
- **Stage 1 (Builder)**: `node:20-alpine` compiles production assets into `dist/`.
- **Stage 2 (Runtime)**: `nginx:alpine` serves static files and reverse-proxies `/api/` using Docker DNS (`127.0.0.11`).

### Build Standalone Images
```powershell
docker build -t DOCKERHUB_USERNAME/express-k8s-demo:latest ./backend
docker build -t DOCKERHUB_USERNAME/react-k8s-demo:latest ./frontend
```

---

## 5. Kubernetes & Minikube Setup

### 1. Start Cluster with Docker Driver
```powershell
# Add Minikube to session PATH if needed
$env:Path = "C:\Program Files\Kubernetes\Minikube;" + $env:Path

minikube start --driver=docker
kubectl get nodes
```

### 2. Enable Ingress Addon
```powershell
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

### 3. Load Local Images into Minikube (Local Testing)
```powershell
minikube image load DOCKERHUB_USERNAME/express-k8s-demo:latest
minikube image load DOCKERHUB_USERNAME/react-k8s-demo:latest
```

### 4. Deploy All Kubernetes Manifests
```powershell
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Deployments & Services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# 3. Ingress & RBAC
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/drone-rbac.yaml
```

### 5. Accessing the Application
On Windows with Minikube Docker driver, forward Ingress traffic:
```powershell
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8085:80
```
Open **`http://localhost:8085`** in your browser.

---

## 6. Self-Healing & Health Probes

### Demo 1: Pod Self-Healing (Pod Termination)
1. Check existing backend pods:
   ```powershell
   kubectl get pods -n k8s-demo
   ```
2. Delete one pod:
   ```powershell
   kubectl delete pod <backend-pod-name> -n k8s-demo
   ```
3. Watch Kubernetes instantly spawn a replacement:
   ```powershell
   kubectl get pods -n k8s-demo -w
   ```
   **Concept**: Desired replicas = 3. When 1 is deleted, Actual = 2. The Kubernetes ReplicaSet controller detects the drift and schedules a replacement within seconds.

---

### Demo 2: Liveness Probe Failure & Kubelet Container Restart
1. Inject a simulated health check failure:
   ```powershell
   kubectl set env deployment/backend -n k8s-demo FAIL_HEALTH_CHECK=true
   ```
2. Observe container restarts:
   ```powershell
   kubectl get pods -n k8s-demo -w
   kubectl describe pod <backend-pod-name> -n k8s-demo
   ```
   **Output**:
   ```
   Warning  Unhealthy  Liveness probe failed: HTTP probe failed with statuscode: 500
   Normal   Killing    Container backend failed liveness probe, will be restarted
   ```
   The `RESTARTS` count increments.
3. Restore healthy state:
   ```powershell
   kubectl set env deployment/backend -n k8s-demo FAIL_HEALTH_CHECK=false
   ```

---

### Demo 3: Liveness vs. Readiness Probes
| Probe | Purpose | K8s Action on Failure |
|---|---|---|
| **Liveness Probe** | Checks if process is deadlocked or broken | Kubelet terminates and restarts the container |
| **Readiness Probe** | Checks if container is ready to serve network traffic | Endpoint controller removes Pod IP from Service endpoints (no traffic) |

---

## 7. Drone CI/CD Infrastructure

### 1. Architecture Overview
Drone Server and Drone Docker Runner run as Linux Docker containers via `drone/docker-compose.yml`.
The runner is attached to the `minikube` Docker network (`DRONE_RUNNER_NETWORKS=minikube`), giving pipeline containers direct DNS access to the Minikube API (`https://minikube:8443`).

### 2. Public Webhook Tunnel (Cloudflare Tunnel / ngrok)
> **Why is a tunnel necessary?**  
> Drone Server runs locally on port 8000. When you push to GitHub, GitHub's public cloud servers must notify Drone via an HTTP POST webhook. Since GitHub cannot reach private IP addresses or `localhost` behind home routers/firewalls, a secure reverse proxy tunnel is required to expose port 8000 to a public HTTPS URL.

#### Cloudflare Tunnel (Quick & Free)
```powershell
# Expose Drone Server to public HTTPS
cloudflared tunnel --url http://localhost:8000
```
This prints an ephemeral public URL like:
`https://creates-aid-dts-flowers.trycloudflare.com` $\rightarrow$ `http://localhost:8000`

Keep this process running in a background terminal.

### 3. GitHub OAuth Setup
1. In GitHub, go to **Settings** $\rightarrow$ **Developer settings** $\rightarrow$ **OAuth Apps** $\rightarrow$ **New OAuth App**.
2. Configure using your tunnel domain:
   - **Application Name**: `Drone Local`
   - **Homepage URL**: `https://<your-tunnel-domain>` (e.g. `https://creates-aid-dts-flowers.trycloudflare.com`)
   - **Authorization callback URL**: `https://<your-tunnel-domain>/login`
3. Generate a Client Secret and copy Client ID & Secret.

### 4. Start Drone Infrastructure
1. Configure `drone/.env`:
   ```ini
   DRONE_GITHUB_CLIENT_ID=<your-github-client-id>
   DRONE_GITHUB_CLIENT_SECRET=<your-github-client-secret>
   DRONE_RPC_SECRET=<your-generated-rpc-secret>
   DRONE_SERVER_HOST=creates-aid-dts-flowers.trycloudflare.com
   DRONE_SERVER_PROTO=https
   DRONE_ADMIN_USER=robaro12345
   ```
2. Start the containers:
   ```powershell
   cd drone
   docker compose up -d
   docker ps --filter "name=drone"
   ```

### 5. Drone Repository Secrets
In the Drone UI (**Settings $\rightarrow$ Secrets**), add:
- `docker_username`: Docker Hub account username (`omkarvbhoir`)
- `docker_password`: Docker Hub personal access token (Read/Write)
- `k8s_token`: Dedicated ServiceAccount token obtained via:
  ```powershell
  kubectl get secret drone-deployer-token -n k8s-demo -o go-template="{{.data.token | base64decode}}"
  ```
~
---

## 8. Pipeline Workflow (`.drone.yml`)

```
git push
   │
   ▼
1. test-backend        (npm ci && npm test)
   │
   ▼
2. test-frontend       (npm ci && npm run build)
   │
   ▼
3. build-backend-image (Docker build & push with tag ${DRONE_BUILD_NUMBER})
   │
   ▼
4. build-frontend-image(Docker build & push with tag ${DRONE_BUILD_NUMBER})
   │
   ▼
5. deploy-to-kubernetes(kubectl set image & rollout status on https://minikube:8443)
```

---

## 9. Rolling Updates & Zero-Downtime Rollout

The deployments use the `RollingUpdate` strategy:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```
- **Surge**: Kubernetes starts 1 new Pod before killing any old Pod.
- **Readiness Check**: The new Pod must pass its readiness probe before receiving traffic.
- **Termination**: Once the new Pod is Ready, an old Pod is gracefully terminated.
- **Zero Downtime**: Users never encounter a 502 Bad Gateway during releases.

### Rollout Inspection Commands
```powershell
kubectl rollout status deployment/backend -n k8s-demo
kubectl rollout history deployment/backend -n k8s-demo
```

### Instant Rollback
To undo a bad deployment:
```powershell
kubectl rollout undo deployment/backend -n k8s-demo
kubectl rollout undo deployment/frontend -n k8s-demo
```

---

## 10. Troubleshooting Guide

### 1. Drone Server Cannot Start
- **Cause**: Port 8000 in use or missing environment variables.
- **Fix**: Check `docker logs drone-server`. Verify `DRONE_GITHUB_CLIENT_ID` and `DRONE_RPC_SECRET` in `drone/.env`.

### 2. GitHub OAuth Fails
- **Cause**: Callback URL mismatch.
- **Fix**: The GitHub OAuth Authorization callback URL must match `http://<DRONE_SERVER_HOST>/login` character-for-character.

### 3. GitHub Webhook Does Not Reach Drone
- **Cause**: Localhost is not publicly accessible to GitHub servers.
- **Fix**: Run `ngrok http 8000` (or `cloudflared tunnel`) and set `DRONE_SERVER_HOST=<subdomain>.ngrok-free.app` with `DRONE_SERVER_PROTO=https`. Update GitHub OAuth and webhook URLs accordingly.

### 4. Drone Runner Does Not Connect
- **Cause**: RPC secret mismatch.
- **Fix**: Verify `DRONE_RPC_SECRET` in `drone-runner` matches `drone-server`. Run `docker logs drone-runner`.

### 5. Docker Push Fails / Authentication Fails
- **Cause**: Invalid Docker Hub credentials or rate limiting.
- **Fix**: Use a Docker Hub Personal Access Token (PAT) with `Read & Write` scope instead of your account password.

### 6. Kubernetes API Cannot Be Reached from Drone
- **Cause**: Pipeline container cannot resolve `minikube` host.
- **Fix**: Ensure `DRONE_RUNNER_NETWORKS=minikube` is configured in `drone/docker-compose.yml`. Minikube API is reachable at `https://minikube:8443`.

### 7. `kubectl` Authentication Fails in Pipeline
- **Cause**: Expired or invalid ServiceAccount token.
- **Fix**: Re-fetch the token:
  ```powershell
  kubectl get secret drone-deployer-token -n k8s-demo -o go-template="{{.data.token | base64decode}}"
  ```
  Update `k8s_token` in Drone secrets.

### 8. Deployment Remains Pending
- **Cause**: Insufficient CPU/Memory in Minikube.
- **Fix**: Run `kubectl describe pod <pod-name> -n k8s-demo` to inspect events.

### 9. ImagePullBackOff
- **Cause**: Image tag not found on Docker Hub or invalid repository path.
- **Fix**: Inspect with `kubectl describe pod <pod-name> -n k8s-demo`. Verify image exists on Docker Hub.

### 10. Readiness Probe Fails
- **Cause**: `/api/health` returned HTTP 500 or timeout.
- **Fix**: Check pod logs: `kubectl logs <pod-name> -n k8s-demo`.

### 11. Ingress Stops Working
- **Cause**: Ingress controller pod restarted or port-forward dropped.
- **Fix**: Run `kubectl get pods -n ingress-nginx` and re-run:
  ```powershell
  kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8085:80
  ```

---
