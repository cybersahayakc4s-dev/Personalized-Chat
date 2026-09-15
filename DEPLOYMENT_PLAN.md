# CYBER SAHAYAK PRODUCTION DEPLOYMENT PLAN: PERSONALIZE CHAT

**Application:** Personalize Chat  
**Target Host:** Cyber Sahayak Production VPS  
**Target Path:** `/opt/company/apps/personalize-chat/`  
**Deployment Model:** Single Dedicated Production Instance (Zero Staging)  
**Database Model:** Dedicated PostgreSQL 16 Container (`personalize_chat_db`) — **100% ISOLATED**  
**Host Ingress:** Internet → HTTPS (Port 443) → Host `company-nginx` → `127.0.0.1:8085` (`personalize_chat_client`)  
**Verified Automated Test Baseline:** **41 / 41 tests passing** (0 failures, 100% pass rate)  
**Deployment Strategy:** **Application-Scoped Deployment with Minimized Interruption Risk**  
**Deployment Status:** **READY FOR PHASE 4 PROVISIONING & PRODUCTION DEPLOYMENT**

---

## 1. PRODUCTION ARCHITECTURE & ISOLATION GUARANTEES

```
Internet (Users & Employees)
   │
   ▼ [HTTPS Port 443 / HTTP Port 80 Redirect]
Host company-nginx (Reverse Proxy & SSL Termination)
   │
   ▼ [Proxy to Loopback http://127.0.0.1:8085]
Personalize Chat Docker Compose Stack (Project: 'personalize_chat')
   │
   ├── personalize_chat_client (Nginx Alpine Web Server & SPA Proxy)
   │     │  • Internal Port: 80
   │     │  • Bound to Host: 127.0.0.1:8085 (Loopback only)
   │     │  • Serves: Compiled React 19 / Vite 6 SPA (/usr/share/nginx/html)
   │     │  • Proxies /api/ and /socket.io/ to server:8000
   │     │  • Health Probe: /healthz
   │     │
   │     └── [Internal Network: personalize_chat_network]
   │           │
   │           ├── personalize_chat_server (FastAPI + Socket.IO ASGI App)
   │           │     • Internal Port: 8000 (Not bound to host)
   │           │     • Single Worker Uvicorn ASGI Process
   │           │     • Persistent Volume: personalize_chat_uploads (/app/uploads)
   │           │     • Health Probe: /health (with DB read/write validation)
   │           │
   │           └── personalize_chat_db (Dedicated PostgreSQL 16 Container)
   │                 • Internal Port: 5432 (Not bound to host)
   │                 • Database: personalize_chat_prod
   │                 • User: personalize_chat_app
   │                 • Persistent Volume: personalize_chat_pgdata (/var/lib/postgresql/data)
   │                 • Health Probe: pg_isready
```

### 1.1 VPS Isolation & Zero-Collision Guarantees
The Cyber Sahayak production VPS hosts critical platform services (CyberSahayak CRM, AI HR, platform databases, and system Nginx). Personalize Chat must never collide with or disrupt these services:
- **Project Isolation:** All containers run under Docker Compose project name `name: personalize_chat`.
- **Explicit Container Names:** `personalize_chat_db`, `personalize_chat_server`, `personalize_chat_client`. No generic names (`postgres`, `nginx`, `redis`, `backend`).
- **Network Isolation:** Internal bridge network `personalize_chat_network`. Completely isolated from other container networks.
- **Port Isolation:** Binds **only** to host loopback interface `127.0.0.1:${APP_PORT:-8085}`. Host ports `80` and `443` remain 100% untouched and owned by host `company-nginx`.
- **Database Isolation:** Personalize Chat runs a dedicated PostgreSQL 16 container (`personalize_chat_db`). It does NOT connect to or touch host PostgreSQL or sibling databases.
  - Connection Pool: FastAPI `QueuePool` configured with 5 connections + 10 overflow (max 15 connections from the single Uvicorn worker). PostgreSQL container 512MB RAM comfortably supports this workload.
- **Resource Constraints:**
  - `personalize_chat_db`: 0.75 CPU limit, 512MB RAM limit.
  - `personalize_chat_server`: 1.00 CPU limit, 1024MB RAM limit.
  - `personalize_chat_client`: 0.50 CPU limit, 256MB RAM limit.
- **Log Rotation:** Docker `json-file` driver configured with `max-size: "20m"` and `max-file: "5"` across all containers to prevent disk exhaustion.

---

## 2. HOST NGINX INTEGRATION SPECIFICATION

The existing host `company-nginx` must be configured to terminate SSL, enforce HTTPS, and reverse-proxy requests to the loopback port `127.0.0.1:8085`.

### Recommended Host Nginx Configuration (`/etc/nginx/sites-available/personalize-chat.conf`):

```nginx
# HTTP - Redirect all traffic to HTTPS
server {
    listen 80;
    server_name chat.company.internal; # Replace with production domain
    return 301 https://$host$request_uri;
}

# HTTPS - Terminate SSL and Reverse Proxy to Personalize Chat
server {
    listen 443 ssl http2;
    server_name chat.company.internal; # Replace with production domain

    # SSL Certificates (Managed by Host Let's Encrypt / Certbot or Company Wildcard)
    ssl_certificate /etc/ssl/certs/company_wildcard.crt;
    ssl_certificate_key /etc/ssl/private/company_wildcard.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Support large file uploads matching application maximum leader ceiling (2048MB)
    client_max_body_size 2048M;
    client_body_timeout 300s;
    client_header_timeout 300s;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Robots-Tag "noindex, nofollow" always;

    # General Web & REST API Routing
    location / {
        proxy_pass http://127.0.0.1:8085;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for streaming large uploads
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # WebSocket Support for Socket.IO Real-Time Engine
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8085/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Persistent WebSocket connections (24 hours)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

> [!CAUTION]
> **Safe Host Nginx Reload Rule:**  
> NEVER run `systemctl restart nginx`. Always run:
> ```bash
> sudo ln -s /etc/nginx/sites-available/personalize-chat.conf /etc/nginx/sites-enabled/
> sudo nginx -t && sudo nginx -s reload
> ```

---

## 3. PRODUCTION DEPLOYMENT PREREQUISITES (PHASE 4 GATES)

Before executing the initial deployment on the Cyber Sahayak VPS, the operations engineer must complete and verify the following 22 prerequisite checks:

1. **Confirm Production FQDN:** Agree on target domain (e.g., `chat.company.internal` or `chat.cybersahayak.com`).
2. **Confirm DNS Resolution:** Verify target FQDN DNS A record points to the VPS public IP address.
3. **Confirm TLS Certificate:** Ensure valid Let's Encrypt or Wildcard certificate exists on the host VPS.
4. **Confirm Free VPS Resources:** Verify host has at least 2 GB free RAM and 20 GB free disk storage (`free -m`, `df -h`).
5. **Confirm Port 8085 Unused:** Run `netstat -tlpn | grep 8085` or `ss -tlpn | grep 8085` to ensure no port collision.
6. **Create Application Root:** `sudo mkdir -p /opt/company/apps/personalize-chat/backups && sudo chown -R $USER:$USER /opt/company/apps/personalize-chat`.
7. **Provision Production Environment File:** Copy `.env.example` to `/opt/company/apps/personalize-chat/.env` (`chmod 600`).
8. **Generate High-Entropy Secrets:** Run `openssl rand -hex 32` for `SECRET_KEY`, generate strong `POSTGRES_PASSWORD` and `INITIAL_ADMIN_PASSWORD`.
9. **Configure ALLOWED_ORIGINS:** Set `ALLOWED_ORIGINS=https://<DOMAIN>,http://127.0.0.1:8085`.
10. **Provision Persistent Volumes:** Docker Compose will create `personalize_chat_pgdata` and `personalize_chat_uploads`.
11. **Verify Database Health:** Ensure database container starts and responds to `pg_isready`.
12. **Verify Backup Capability:** Test `docker compose exec -T db pg_dump` generates a valid SQL dump.
13. **Verify Exact Git SHA:** Confirm deployment checks out an exact commit SHA rather than a floating branch tag.
14. **Review Migration Chain:** Confirm single Alembic migration head (`630c01cd9424_0001_initial_baseline.py`) with zero destructive SQL statements.
15. **Take Pre-Deployment Backup:** Execute point-in-time snapshot to `backups/personalize_chat_backup_<timestamp>.sql`.
16. **Deploy ONLY Personalize Chat:** Use application-scoped `docker compose up -d server client`.
17. **Verify Application Healthcheck:** Confirm `GET http://127.0.0.1:8085/health` returns HTTP 200 within 60s.
18. **Perform Smoke Test:** Test login, DM messaging, team channel post, file upload, file download, and Socket.IO presence.
19. **Verify CyberSahayak CRM:** Confirm CRM web application and background jobs remain 100% operational with 0 errors.
20. **Verify AI HR Application:** Confirm AI HR services and databases remain 100% operational with 0 errors.
21. **Verify Platform Infrastructure:** Confirm shared host services (PostgreSQL, Redis, monitoring) remain undisturbed.
22. **Verify Host Resource Usage:** Confirm total VPS CPU/RAM/Disk remain comfortably within safe operational thresholds.

---

## 4. COMMAND RUNBOOK

### CATEGORY A: SAFE TO RUN LOCALLY NOW (Validation & Testing)
These commands run locally and touch zero production systems:

```bash
# 1. Run full backend automated test suite (41 tests)
.\.venv\Scripts\pytest.exe server/tests/test_api.py -v

# 2. Verify frontend TypeScript type-checking and production Vite build
cd client && npm run build

# 3. Validate Docker Compose syntax
docker compose config
```

---

### CATEGORY B: REQUIRES ADMIN APPROVAL (VPS Initial Provisioning)
Execute once on the Cyber Sahayak VPS when provisioning the application root:

```bash
# 1. Create dedicated application tree and backup directory
sudo mkdir -p /opt/company/apps/personalize-chat/backups
sudo chown -R $USER:$USER /opt/company/apps/personalize-chat

# 2. Clone repository into the dedicated path
git clone <REPO_GIT_URL> /opt/company/apps/personalize-chat
cd /opt/company/apps/personalize-chat

# 3. Provision production environment secrets
cp .env.example .env
chmod 600 .env

# 4. Administrator edits .env with production secrets
# (Generate SECRET_KEY with: openssl rand -hex 32)
nano .env

# 5. Verify and reload host company-nginx
sudo nginx -t && sudo nginx -s reload
```

---

### CATEGORY C: PRODUCTION DEPLOYMENT COMMANDS (Manual or CI/CD)
These commands are executed during an automated or manual deployment:

```bash
cd /opt/company/apps/personalize-chat

# Step 1: Explicitly export environment variables into execution context
set -a
. ./.env
set +a

# Step 2: Record current deployment SHA for rollback tracking
PREVIOUS_SHA=$(cat .last_deployed_sha 2>/dev/null || git rev-parse HEAD || echo "")
echo "$PREVIOUS_SHA" > .last_deployed_sha
echo "Current deployed SHA: $PREVIOUS_SHA"

# Step 3: Fetch target Git SHA and execute dynamic migration safety gate
git fetch origin main
TARGET_SHA="<TARGET_GIT_SHA>"

if [ -n "$PREVIOUS_SHA" ] && [ "$PREVIOUS_SHA" != "$TARGET_SHA" ]; then
  echo "Inspecting migration scripts between $PREVIOUS_SHA and $TARGET_SHA..."
  MIGRATION_DIFF=$(git diff --name-only "$PREVIOUS_SHA" "$TARGET_SHA" -- server/alembic/versions/ || true)
  if [ -n "$MIGRATION_DIFF" ]; then
    for file in $MIGRATION_DIFF; do
      if git show "$TARGET_SHA:$file" | grep -iE '\b(drop_table|drop_column|truncate)\b|op\.execute\(.*(DROP|DELETE|TRUNCATE)'; then
        echo "CRITICAL ERROR: Destructive migration statement detected in $file! Deployment aborted."
        exit 1
      fi
    done
    echo "Migration safety check passed: No destructive operations detected."
  fi
fi

# Step 4: Create pre-deployment PostgreSQL backup snapshot
mkdir -p backups
BACKUP_FILE="backups/personalize_chat_backup_$(date +%Y%m%d_%H%M%S).sql"
if docker compose ps --services --filter "status=running" | grep -q "^db$"; then
  echo "Creating point-in-time database snapshot: $BACKUP_FILE..."
  docker compose exec -T db pg_dump -U "${POSTGRES_USER:-personalize_chat_app}" "${POSTGRES_DB:-personalize_chat_prod}" > "$BACKUP_FILE" || {
    echo "WARNING: Database backup failed. Proceeding with caution."
  }
fi

# Step 5: Checkout exact deployment commit SHA
git checkout "$TARGET_SHA"

# Step 6: Pre-Traffic Build & Migration Execution (Ordering Safety Guarantee)
# Build new container images WITHOUT restarting running production services yet
docker compose build server client

# Ensure database container is up and healthy
docker compose up -d db

# Execute Alembic migrations using a one-off container with the NEW server image.
# If migrations fail, the command exits here and live production containers are NOT modified!
echo "Running Alembic migrations..."
docker compose run --rm server alembic upgrade head

# Step 7: Restart application containers with updated code against verified schema
# Scoped strictly to Personalize Chat services to avoid touching sibling applications
docker compose up -d server client

# Step 8: Verify health check
HEALTH_URL="http://127.0.0.1:${APP_PORT:-8085}/health"
HEALTHY=false
for i in $(seq 1 12); do
  echo "Probing health check $i/12 at $HEALTH_URL..."
  HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "Health check PASS (HTTP 200)!"
    cat /tmp/health_response.json
    HEALTHY=true
    break
  fi
  sleep 5
done

if [ "$HEALTHY" != "true" ]; then
  echo "CRITICAL: Post-deploy health check failed! Initiating automatic code rollback..."
  if [ -n "$PREVIOUS_SHA" ]; then
    git checkout "$PREVIOUS_SHA"
    docker compose up -d --build server client
    sleep 5
    curl -f "$HEALTH_URL" || echo "ALERT: Rollback container health check failed! Manual review required."
  fi
  exit 1
fi

echo "Deployment successful: Personalize Chat is LIVE."
```

---

## 5. BACKUP ARCHITECTURE & RPO SPECIFICATION

### 5.1 Backup Realities & Classification
- **Application Level:** The application itself contains no internal backup cron or scheduler. Backup execution is managed externally via deployment hooks and VPS cron tasks.
- **Pre-Deployment Backup:** A point-in-time SQL snapshot taken immediately prior to Alembic migrations or container updates. It significantly minimizes rollback exposure, but **does not guarantee zero data loss** if data is written concurrently during container transition.
- **Daily VPS Host Backup:** RPO (Recovery Point Objective) is approximately **up to 24 hours**.
- **Point-In-Time Recovery (PITR):** **Not configured.** (PostgreSQL WAL archiving is not active).
- **R2 / Offsite Backup:** **Disabled.** Respects the project requirement that paid offsite/R2 backup is not utilized.

---

## 6. ROLLBACK PROCEDURES

### 6.1 Automatic Code Rollback (Application-Scoped)
Triggered automatically by the CI/CD pipeline if the `/health` check fails or times out:
```bash
cd /opt/company/apps/personalize-chat
ROLLBACK_SHA=$(cat .last_deployed_sha)
echo "Executing automatic code rollback to: $ROLLBACK_SHA"

git checkout "$ROLLBACK_SHA"
docker compose up -d --build server client
curl -f "http://127.0.0.1:${APP_PORT:-8085}/health"
```

### 6.2 Manual Database Rollback Procedure (Deliberate Human Sign-Off)
> [!IMPORTANT]
> **WHY DATABASE ROLLBACK IS NEVER AUTOMATIC:**  
> Restoring a database snapshot permanently overwrites data written since the backup was taken. Therefore, database rollbacks are strictly manual and require explicit senior engineer authorization.

If an applied migration corrupted data and cannot be fixed forward:
```bash
cd /opt/company/apps/personalize-chat
set -a; . ./.env; set +a

# 1. Stop traffic to prevent write corruption
docker compose stop server client

# 2. Terminate active connections and restore pre-deploy snapshot
LATEST_BACKUP=$(ls -t backups/personalize_chat_backup_*.sql | head -n 1)
echo "Restoring database from: $LATEST_BACKUP"

docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE $POSTGRES_DB;"
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;"
cat "$LATEST_BACKUP" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# 3. Checkout matching code SHA and restart
ROLLBACK_SHA=$(cat .last_deployed_sha)
git checkout "$ROLLBACK_SHA"
docker compose up -d --build server client
curl -f "http://127.0.0.1:${APP_PORT:-8085}/health"
```

---

## 7. HOST SAFETY & COLLATERAL PROTECTION GUARANTEES

To guarantee that sibling applications on the VPS (CRM, AI HR, platform Nginx) experience zero disruption:
1. **Never run `docker compose down`:** Always use `docker compose up -d server client`.
2. **Never run `docker system prune` or host-wide restarts:** Scoped strictly to `/opt/company/apps/personalize-chat/`.
3. **Never restart the Docker daemon (`systemctl restart docker`):** This would restart all containers on the host.
4. **Never restart host Nginx (`systemctl restart nginx`):** Use `sudo nginx -t && sudo nginx -s reload`.
5. **Never touch host PostgreSQL or Redis:** Personalize Chat uses its own isolated PostgreSQL container.
6. **Scoped Compose Commands:** Target explicit service names (`server`, `client`, `db`) inside `/opt/company/apps/personalize-chat/`.
