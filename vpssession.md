# VPS Deployment Session Record: Personalize Chat

**Date**: September 17, 2026  
**Previous Session**: September 15–16, 2026 (audit, bootstrap, CI/CD fixes)
**Target Host**: `teamai@187.127.148.60` (`srv1901377` / `cybersahayak-vps`)  
**Public Hostname**: `https://chat.cybersahayak.cloud`  
**Deployed Git SHA**: `0bee36c54b5fad744ab58537e65b725736f6bc32` (auto-deployed via CI, main HEAD — includes v2.2 Electron merge)  
**Repository**: `https://github.com/cybersahayakc4s-dev/Personalized-Chat.git`  
**Target VPS Path**: `/opt/company/apps/personalize-chat/`  

---

## 1. Executive Summary

This session completed the end-to-end production deployment, CI/CD automation, ingress integration, and live verification of **Personalize Chat** on the Cyber Sahayak production VPS with zero disruption to sibling services (CRM, AI-HR, Platform).

### Final State
- **Chat is LIVE** at `https://chat.cybersahayak.cloud` (200, `/health` OK)
- **Auto-deploy works**: push to `main` → CI builds + scp-deploys to VPS
- **All containers healthy**: `personalize_chat_db`, `server`, `client` (all running, zero restarts)
- **Sibling services untouched**: CRM, HR, Platform, company-nginx all healthy

---

## 2. GitHub Repository Details

| Field | Value |
|---|---|
| **Org/Repo** | `cybersahayakc4s-dev/Personalized-Chat` |
| **Remote URL** | `https://github.com/cybersahayakc4s-dev/Personalized-Chat.git` |
| **Main Branch** | `main` |
| **HEAD SHA** | `77eab24ac2e63830ec0071ef9e884ba0001cb2eb` |
| **Default Branch** | `main` |

### Repository Secrets (confirmed via `gh secret list`)
| Secret Name | Value | Purpose |
|---|---|---|
| `VPS_HOST` | `187.127.148.60` | VPS IP for SSH/SCP |
| `VPS_USER` | `teamai` | SSH user on VPS |
| `SSH_KEY` | *(private SSH key)* | SSH/SCP authentication to VPS |
| `VPS_SSH_PORT` | *(not set, defaults 22)* | SSH port |
| `VPS_KNOWN_HOSTS` | *(not set)* | Optional host key pinning |

**NOTE:** The workflow originally referenced `secrets.VPS_SSH_KEY` but the actual repo secret is `SSH_KEY`. This was the root cause of the initial CI deploy failure. Fixed in commit `f03c0b8`.

### CI/CD Workflow (`.github/workflows/deploy-production.yml`)

**Pipeline architecture (auto-deploy, no GitHub creds on VPS):**

1. **CI Test & Build job**: pytest (41 tests), frontend build, migration safety scan
2. **Deploy job** (triggered on `main` push):
   - `actions/checkout@v4` (full history)
   - `tar -czf /tmp/personalize_chat_deploy.tar.gz docker-compose.prod.yml server client`
   - `appleboy/scp-action@v1` uploads tarball to `/opt/company/apps/personalize-chat/tmp/`
   - SSH deploy script on VPS: sources `.env`, backs up DB + code tree, extracts tarball, builds images, `alembic upgrade head`, restarts containers, health-check loop with auto-rollback from code backup

**Key workflow design decisions:**
- **No GitHub credentials stored on VPS** — code delivered via scp from CI runner (which already has the checkout)
- **Code rollback**: Before each deploy, current `docker-compose.prod.yml server client` is archived to `backups/code_<SHA>.tar.gz`; on health-check failure, previous code archive is extracted
- **Migration safety**: CI test job scans push range for destructive SQL (DROP/TRUNCATE); VPS `alembic upgrade head` is the final gate
- **Deploy job is blocking** (`continue-on-error` removed once auto-deploy worked)

---

## 3. VPS Details

### SSH Access (from this machine)
```powershell
ssh -i "C:\Users\kunal\.ssh\deploy_key" -o IdentitiesOnly=yes -o BatchMode=yes teamai@187.127.148.60
```
- **Key location**: `C:\Users\kunal\.ssh\deploy_key` (passphrase-free)
- **NEVER**: display key contents, copy key to VPS, commit credentials

### VPS OS & Docker
| Item | Value |
|---|---|
| OS | Ubuntu 24.04.4 LTS (GNU/Linux 5.15.0-135-generic x86_64) |
| Docker | 29.7.2 |
| Docker Compose | v5.4.0 |
| Disk | 145GB total, 34GB used (24%) |
| RAM | 3.7GB total, 1.8GB used (51%) |
| Swap | 1.0GB total, 0B used (0%) |

### App Directory (`/opt/company/apps/personalize-chat/`)
| File/Dir | Purpose |
|---|---|
| `.env` (mode 600) | Production config (16 vars, secrets generated on VPS) |
| `.last_deployed_sha` | Tracks current deployed SHA |
| `docker-compose.prod.yml` | Compose file (3 services) |
| `backups/` | DB dumps + code archives for rollback |
| `server/`, `client/` | App source (overwritten by tarball on deploy) |
| `.git/` | Git repo (origin = stale bundle, not used by auto-deploy) |

### Production `.env` (on VPS)
```bash
ENVIRONMENT=production
SECRET_KEY=<generated on VPS>
ALLOWED_ORIGINS=https://chat.cybersahayak.cloud
POSTGRES_USER=personalize_chat_app
POSTGRES_PASSWORD=<generated on VPS>
POSTGRES_DB=personalize_chat_prod
INITIAL_ADMIN_EMAIL=admin@company.internal
INITIAL_ADMIN_NAME="Main Admin"
INITIAL_ADMIN_PASSWORD=WzBBOaN8RXYZHnL5wlRpiEr9
DEFAULT_MAX_FILE_SIZE_MB=2048
DEFAULT_LEADER_CEILING_MB=2048
APP_PORT=8085
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=60
LOG_LEVEL=INFO
RATE_LIMIT_ENABLED=true
```

**NOTE:** `INITIAL_ADMIN_NAME` must be quoted in `.env` (contains space). Without quotes, the deploy script's `. ./.env` fails with `Admin: command not found`.

### Docker Containers
| Container | Image | Status | Network | Notes |
|---|---|---|---|---|
| `personalize_chat_db` | `postgres:16-alpine` | Up, healthy | `personalize_chat_network` | 0.75 CPU, 512MB RAM |
| `personalize_chat_server` | `personalize_chat-server` | Up, healthy | `personalize_chat_network` | 1.0 CPU, 1GB RAM, single Uvicorn worker |
| `personalize_chat_client` | `personalize_chat-client` | Up, healthy | `personalize_chat_network` + `company-internal` | 0.5 CPU, 256MB RAM |

**Volumes**: `personalize_chat_pgdata` (DB), `personalize_chat_uploads` (file storage)

### Docker Healthcheck Fix
The repo's `docker-compose.prod.yml` had `http://localhost:80/healthz` for client healthcheck, but nginx only listens on IPv4. BusyBox wget with `localhost` resolves to `::1` (IPv6) → connection refused → `unhealthy`. Fixed to `http://127.0.0.1:80/healthz` (committed as `77eab24`).

---

## 4. Ingress Architecture

### `company-nginx` Container
| Item | Value |
|---|---|
| Container | `company-nginx` (`nginx:1.29-alpine`) |
| Networks | `company-internal` + `company-public` |
| Ports | 80 + 443 (host-bound) |
| Restart policy | RestartCount=34 (stable) |

### Personalize Chat vhost
- **Config file**: `/opt/company/shared/nginx/conf.d/chat.cybersahayak.cloud.conf`
- **Upstream**: `http://personalize_chat_client:80`
- **TLS cert**: `/opt/company/shared/nginx/certs/personalize-chat/chat-origin.crt` (Cloudflare Origin CA, valid 2041)
- **TLS key**: `/opt/company/shared/nginx/certs/personalize-chat/chat-origin.key`
- **SNI**: `*.cybersahayak.cloud` + `chat.cybersahayak.cloud`
- **Cloudflare mode**: Full (Strict)

### Public DNS (Cloudflare)
| Record | Value |
|---|---|
| A (chat.cybersahayak.cloud) | 104.21.18.4 / 172.67.178.249 (Cloudflare proxy) |

### Sibling App Regression Check (all pre-deploy values preserved)
| App | URL | Status |
|---|---|---|
| CRM | https://app.cybersahayak.cloud | 200 OK |
| AI-HR | https://hr.cybersahayak.cloud | 307 Redirect |
| Platform | https://platform.cybersahayak.cloud | 200 OK |

---

## 5. Application Login Credentials

| Field | Value |
|---|---|
| **URL** | `https://chat.cybersahayak.cloud` |
| **Email** | `admin@company.internal` |
| **Password** | `WzBBOaN8RXYZHnL5wlRpiEr9` |
| **Role** | Main-Admin (`is_main_admin=True`) |

**NOTE**: No public sign-up. Users are provisioned through the admin console. Password should be rotated after testing.

---

## 6. CI/CD History

| Commit | Title | CI Test | CI Deploy | VPS Status |
|---|---|---|---|---|
| `49f9610` | feat: complete Phase 2/3 | — | — | **UNDEPLOYABLE** (missing `initialData.ts`) |
| `6eb7f79` | ci: fix CI admin env + deploy | PASS | FAIL (`VPS_SSH_KEY` secret mismatch) | — |
| `68b1bdf` | fix: un-ignore client/src/data | PASS | FAIL | **Deployed manually** (direct) |
| `f03c0b8` | ci: use `SSH_KEY` secret | PASS | FAIL (git bundle origin stale) | — |
| `a4dfd79` | ci: make deploy non-blocking | PASS | FAIL (continue-on-error) | — |
| `a36870f` | ci: scp-based auto deploy | PASS | FAIL (tarball path) | — |
| `77eab24` | ci: extract from tmp/ path | PASS | **PASS** | **Live, auto-deployed** |
| `0bee36c` | merge PR #1: v2.2 Electron chat upgrades | PASS | **PASS** | **Live, auto-deployed** (current HEAD) |

## 6B. v2.2 Electron — Whatsapp-Style Chat Integration (PR #1, merged `0bee36c`)

Third-party merge on `main` delivered via `integration/v2.2-electron-chat-upgrades`:

- **Electron desktop app**: new `electron/` (main.js 432 lines, preload.js, quick-reply.html), root `package.json` workspace, `scripts/verify_electron.cjs` + `scripts/test_security_regression.cjs`.
- **WhatsApp-style chat**: pinned messages, Team Updates carousel (`TeamUpdatesCarousel.tsx`), schedule-timed updates (`ScheduleUpdateModal.tsx`), in-chat search, refreshed MessageItem/RightSidebar/LoginModal.
- **API/security hardening**: `server/app/api/messages.py`, `server/app/core/config.py`, `server/app/services/message_service.py` + new client service methods.
- **Post-merge verification**: CI green, auto-deploy applied to VPS, all 3 containers healthy, server `/health` OK. (Public curl re-check skipped this session due to restart.)

---

## 7. Known Issues & Follow-Ups

1. **VPS `.git/` stale**: Origin points to `/tmp/personalize-chat.bundle` (snapshot at 68b1bdf). No longer used by auto-deploy (tarball-based). The `.git/` directory is harmless but unused; could be removed.
2. **Stale files in app dir**: Tarball extraction overwrites tracked files but doesn't delete files removed upstream (low risk for this small app).
3. **`INITIAL_ADMIN_PASSWORD` in plaintext**: Currently in `.env` on VPS (mode 600, not in repo). Rotate after initial login.
4. **Migrations safety gate**: CI test job scans push range for destructive SQL. VPS runs `alembic upgrade head`. No manual gate needed.
5. **Session open items**: public URL curl re-check (chat 200 / health 200 on `0bee36c`) and `gh run` backfill after system restart; confirm `new client/package.json` deps built cleanly by CI (they did — deploy job passed).

---

## 8. Emergency Rollback Procedure

If auto-deploy fails and manual intervention is needed:

```bash
# SSH to VPS
ssh -i "C:\Users\kunal\.ssh\deploy_key" -o IdentitiesOnly=yes teamai@187.127.148.60

# Find latest code backup
ls /opt/company/apps/personalize-chat/backups/code_*.tar.gz

# Restore code from backup
cd /opt/company/apps/personalize-chat
tar -xzf backups/code_<PREVIOUS_SHA>.tar.gz

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build server client

# Verify health
docker compose -f docker-compose.prod.yml exec -T server curl -sf http://localhost:8000/health
```

**DB rollback** (if needed): restore from `backups/personalize_chat_backup_<timestamp>.sql`:
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U personalize_chat_app -d personalize_chat_prod < backups/personalize_chat_backup_<timestamp>.sql
```
