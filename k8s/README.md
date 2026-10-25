# SeniorSOS on Kubernetes

Runs the app on the local Docker Desktop Kubernetes cluster: 2+ backend copies,
2+ frontend copies and Redis, with the cloud databases (Neon PostgreSQL, Atlas
MongoDB, Neo4j Aura) used exactly as in normal development.

```
 browser ──> http://localhost:8080
               │
               ▼
        frontend (nginx x2) ── serves the React app
               │  /api and /socket.io
               ▼
        backend (Express + Socket.IO, 2 to 4 copies, autoscaled)
          │            │
          │            └──> Redis (cache, rate limits, presence, realtime between copies)
          ▼
   Neon PostgreSQL · Atlas MongoDB · Neo4j Aura   (external, never modified by Kubernetes)
```

## Safety, in short

- **The cloud databases are only connected to.** There is no migration job, seed
  job or schema step anywhere in `k8s/`. Using the app writes data exactly as it
  does with `npm run dev` (registering, editing a profile, ...), to the same databases.
- **No credentials in the repository.** `deploy.ps1` builds the Secret from
  `backend/.env` when you deploy. The images never contain `.env`.
- **It refuses to touch any cluster except `docker-desktop`.**
- **`run.ps1` and normal development are unaffected.** The cluster uses its own
  Redis and its own port (8080).

## Prerequisites (once)

1. Docker Desktop running, with **Settings > Kubernetes > Enable Kubernetes** on
   (single node is enough). Wait until it shows *running*.
2. `kubectl` on the PATH (it comes with Docker Desktop).
3. `backend/.env` filled in, as for normal development.
4. About 4 GB of free memory for the cluster.

## Run it

```powershell
.\k8s\deploy.ps1 -Build     # first time, or after code changes: build images and deploy
.\k8s\deploy.ps1            # redeploy without rebuilding
```

Then open **http://localhost:8080** and log in.

Stop it (removes only the `seniorsos` namespace; cloud data is untouched):

```powershell
.\k8s\teardown.ps1
```

## Check that it is working

```powershell
.\k8s\verify.ps1
```

It is read-only and prints PASS / WARN / FAIL for: the cluster, the pods and their
restarts, the Secret, the app through `localhost:8080`, each backend's database and
Redis connections, the autoscalers (with real CPU readings) and the disruption
budgets. It exits with code 1 on any FAIL.

By hand:

```powershell
kubectl get pods -n seniorsos                  # 5 pods, all Running and 1/1
kubectl get hpa  -n seniorsos                  # autoscalers: current CPU vs target
kubectl top pods -n seniorsos                  # live CPU and memory
curl http://localhost:8080/health              # {"status":"ok", ... "redis":"up"}
kubectl logs -n seniorsos deploy/backend       # start-up log of one backend copy
```

## Things to try

```powershell
# Self-healing: delete a backend pod and watch it come back, while the app keeps working
kubectl delete pod -n seniorsos -l app=backend --field-selector=status.phase=Running --wait=false
kubectl get pods -n seniorsos -w

# Scale by hand (the autoscaler adjusts it again, between 2 and 4)
kubectl scale deployment/backend -n seniorsos --replicas=3

# Update with no downtime, then go back
kubectl rollout restart deployment/backend -n seniorsos
kubectl rollout history deployment/backend -n seniorsos
kubectl rollout undo    deployment/backend -n seniorsos
```

## What is in here

| Path | What it is |
|---|---|
| `kustomization.yaml` | Lists everything that is applied |
| `base/namespace.yaml`, `base/configmap.yaml` | The `seniorsos` namespace and the non-secret settings |
| `backend/backend.yaml` | Backend Deployment, Service, autoscaler (2 to 4) and disruption budget |
| `frontend/frontend.yaml` | nginx Deployment, the LoadBalancer Service on port 8080, autoscaler (2 to 3) and disruption budget |
| `redis/redis.yaml` | Redis for cache, rate limits, presence and realtime |
| `addons/metrics-server.yaml` | CPU/memory metrics, needed by the autoscaler (installed in `kube-system`, left in place by teardown) |
| `deploy.ps1`, `verify.ps1`, `teardown.ps1` | Deploy, check and remove |

Images are built from `backend/Dockerfile` and `frontend/Dockerfile` (see
`docker-compose.app.yml` for running them without Kubernetes). `deploy.ps1` tags
each image by its content, so a rebuild always rolls out; re-using one tag would
leave the cluster running the old code.

## How it behaves

- **Rolling updates and rollbacks** never take a copy away before its replacement
  is ready, and a short drain delay lets in-flight requests finish. Under steady
  traffic these caused no failed requests in testing.
- **Autoscaling** adds backend copies when CPU passes 70% of the request (200m) and
  removes them again after two quiet minutes.
- **Realtime across copies** works through Redis: a user connected to one backend
  sees live messages and presence updates from a user on another. The frontend
  uses WebSocket only, because Socket.IO's long-polling fallback needs every
  request from a client to reach the same copy, which a load balancer cannot promise.
- **If Redis is down** the app keeps working without caching or shared rate limits,
  and recovers by itself when Redis returns.
- **Start-up order does not matter.** The backend waits up to 30 s for Redis
  before deciding whether to enable cross-copy realtime.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `deploy.ps1` says the context is not `docker-desktop` | Enable Kubernetes in Docker Desktop, then `kubectl config use-context docker-desktop` |
| `deploy.ps1` says an image is not found | Run `.\k8s\deploy.ps1 -Build` |
| A backend pod is `CrashLoopBackOff` | `kubectl logs -n seniorsos <pod>`. Usually a wrong value in `backend/.env`; fix it and run `.\k8s\deploy.ps1` again |
| `localhost:8080` does not open | `kubectl get svc -n seniorsos frontend`. As a fallback: `kubectl port-forward -n seniorsos svc/frontend 8080:8080` |
| `verify.ps1` warns about CPU readings | metrics-server needs about a minute after the first deploy; run it again |
| `/health` shows `"redis":"down"` | `kubectl get pods -n seniorsos -l app=redis`. The app still works; it recovers when Redis is back |
| Port 8080 is taken | Stop whatever uses it, or change the `port` in `frontend/frontend.yaml` and `CLIENT_ORIGIN` in `base/configmap.yaml` |
| Prisma `EPERM` when running `run.ps1` | Unrelated to the cluster: a locally running backend holds the Prisma file. Stop it and retry |
