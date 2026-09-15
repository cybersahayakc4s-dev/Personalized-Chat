# Master Plan — Internal Company Chat System
*Final specification for build. Prepared for implementation by an AI coding agent (Antigravity).*

---

## 1. Project Summary

Build a self-hosted, text-based internal chat web application for a company.
Only a single top-level admin ("Main-Admin") can create user accounts — there is
no public sign-up anywhere. Employees are optionally tagged with one team, get
1:1 direct messages with everyone in the company, and a group chat with their own
team. The app must be architected as a clean client/server SPA (React frontend +
FastAPI backend) so it can later be wrapped in Electron into a `.exe` desktop
client with no backend changes.

---

## 2. Roles & Permissions

**⚠️ Naming — do not confuse these two:**
- **Main-Admin** — the single top-level system role (the CEO account). Full control
  over users, teams, passwords.
- **`hr_admin`** — just one of the five *team tags* (for HR & Managers). A person
  on this team is a normal Employee with zero elevated system permissions. Never
  treat `hr_admin` as equivalent to Main-Admin anywhere in code, routes, or UI copy.

| Role | Can do |
|---|---|
| **Main-Admin** | Create/disable/delete users · assign/change a user's team · reset/set any user's password (only path to password recovery) · override any team's file-size limit · **chats like a normal user AND has visibility/participation in every team's group chat, regardless of personal team membership** (for oversight) · appears in everyone's DM sidebar like anyone else |
| **Team Leader** | A flag on one Employee per team (assigned by Main-Admin) · everything a normal Employee can do · plus: can raise their own team's per-file upload limit above the 500MB default (up to a hard ceiling — see §6) |
| **Employee** | Login · DM any other user · post in own team's group chat (if assigned a team) · edit/delete own messages · upload files within the team's current limit · appears in everyone else's sidebar |

Fixed team enum (v1 — not a dynamic table, exactly these five):
```
team_ai
team_legal
hr_admin
seo
coordination
```
New users start with **no team** until Main-Admin assigns one.

---

## 3. Full Feature List (v1)

### Auth
- Login (single form; backend returns role, frontend routes to Main-Admin panel or chat view accordingly)
- No public registration route exists anywhere
- Session/token-based auth, reasonable expiry + logout
- Only Main-Admin can set or reset any password — no self-service "forgot password" flow. Main-Admin generates a new password and relays it to the employee (passwords are hashed one-way; the original is never retrievable, by design)

### Main-Admin Panel
- Create user (name, email, initial password, optional team assignment)
- Edit user (change team, toggle Team Leader flag, disable/enable account)
- Reset a user's password
- View all users with their team + status
- View/adjust any team's `max_file_size_mb` (bypassing the Team Leader ceiling)

### Chat — Core
- Sidebar section 1 ("Recent"): every other user in the company (never yourself), sorted by most recent DM interaction, unread badge per user
- Sidebar section 2 ("Teams"): a collapsible dropdown/accordion for every one of the five teams, always visible to everyone (a directory, not access control) — expanding a team shows its current member list. Clicking a member's name opens/starts a DM with them. Clicking a team's header opens that team's group chat, but only if the viewer is actually a member of that team — or is Main-Admin, who can open any team's chat regardless
- 1:1 direct messaging, real-time delivery via WebSocket
- Team group chat, real-time delivery to all current members (and to Main-Admin, for every team)
- Text messages with edit and delete (soft delete — render "message deleted", don't hard-remove the row)
- "Seen" indicator on DMs (delivered vs. read, like WhatsApp) — not just an unread count
- Scrollable message history (load older messages on scroll-up)

### Team Membership History (WhatsApp-style scoping)
- When Main-Admin moves/removes a user from a team, that user permanently retains read access **only** to messages sent during the exact window they were a member — nothing from before they joined, nothing from after they left
- This requires an append-only `TeamMembership` log (join/leave timestamps), not just a "current team" field
- Default assumption: the team chat stays in a removed user's sidebar as a read-only archive of their own window (not deleted from their view) — flip this if the company would rather it disappear entirely on removal

### File Sharing
- Any file type accepted
- Default per-file limit: **500MB**
- A team's Team Leader can raise their own team's limit above 500MB, up to a hard ceiling (recommend 2-3GB given VPS disk size — see §6); Main-Admin can exceed the ceiling for any team
- Every uploaded file is scanned by ClamAV before it becomes downloadable; while scanning, the message shows a pending state; if infected, the file is blocked and the sender is notified
- Disk-usage alert to Main-Admin at ~80% full

---

## 4. Explicitly Out of Scope (v1) — Do Not Build These

- Public self-registration of any kind
- Self-service "forgot password" / email reset links
- Voice or video calling, screen sharing
- Read receipts / presence for team group chats (only DMs get "seen" ticks in v1)
- Search across message history
- Push notifications outside the app (email digests, mobile push)
- Admin analytics/reporting dashboards
- Dynamic/custom teams beyond the fixed five listed in §2
- Multiple teams per user — one team (or none) only

---

## 5. Data Model (Final)

```
User
  id
  name
  email
  password_hash      -- bcrypt, one-way, never stored/returned as plaintext
  is_main_admin       (bool)
  team                (enum, nullable: team_ai | team_legal | hr_admin | seo | coordination)
  is_team_leader      (bool — applies to their currently assigned team)
  status              (active | disabled)
  created_by          (user id of the Main-Admin who created them)
  created_at

TeamMembership
  id
  user_id
  team
  joined_at
  left_at             (nullable — null = currently active member)
  -- append-only log. Used to scope team chat history reads to the exact
  -- window(s) a user was actually a member, per §3.

TeamSettings
  team                (enum, primary key)
  max_file_size_mb    (int, default 500)
  updated_by          (user id)
  updated_at

Message
  id
  sender_id
  receiver_id         (nullable — set for 1:1 DMs; mutually exclusive with `team`)
  team                (nullable — set for team group messages)
  content             (nullable if the message is purely a file attachment)
  created_at
  edited_at           (nullable)
  deleted_at          (nullable — soft delete; render as "message deleted")
  read_at             (nullable — DM-only, powers the seen indicator)

Attachment
  id
  message_id
  file_name
  file_path
  file_size_bytes
  mime_type
  scan_status         (pending | clean | infected)
  scanned_at
```

No `Channel` table — teams are a fixed enum, so a "team chat" is simply "messages
where `team = X`," scoped per-reader through `TeamMembership`.

---

## 6. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Clean SPA; wraps into Electron later with no rewrite |
| Backend | FastAPI (Python) | Async, native WebSocket support |
| Realtime | Socket.IO (python-socketio + socket.io-client) | Reconnect/room handling for laptops sleeping/waking |
| Database | PostgreSQL | Simple schema now, room to grow |
| File storage | Local disk / mounted volume | No app-level size cap; monitor disk usage |
| Malware scanning | ClamAV (local daemon) | Free, self-hostable, scans every upload pre-delivery |
| Deployment | Docker Compose (FastAPI + Postgres + Nginx) | Self-hosted; Nginx needs `client_max_body_size` raised and WebSocket upgrade headers configured |
| Desktop (future) | Electron wrapping the built React app | Points at the hosted backend URL; zero backend changes required |

**Current host:** Ubuntu VPS, 16GB RAM, 200GB disk — sized for a beginner setup and
expected to be upgraded later; don't over-optimize for these exact numbers now.
Recommended Team-Leader file-size ceiling given this disk: **2-3GB**, not higher,
until storage is expanded.

### Design tokens (Light / Dark)

| Token | Light | Dark |
|---|---|---|
| Page background | `#FFFFFF` | `#0F172A` |
| Sidebar / surface | `#F8FAFC` | `#1E293B` |
| Border | `#E2E8F0` | `#334155` |
| Text primary | `#0F172A` | `#F1F5F9` |
| Text secondary | `#64748B` | `#94A3B8` |
| Accent (brand, buttons, links, own bubble) | `#4F46E5` | `#6366F1` |
| Own message bubble | `#4F46E5` bg / white text | `#6366F1` bg / white text |
| Other's message bubble | `#F1F5F9` bg / dark text | `#1E293B` bg / light text |
| Unread badge | `#4F46E5` | `#6366F1` |
| Online indicator | `#22C55E` | `#4ADE80` |

Optional per-team accent chips for the sidebar directory (purely visual, no
functional meaning): `team_ai` violet, `team_legal` amber/gold, `hr_admin` teal,
`seo` orange, `coordination` blue.

---

## 7. API Surface (high-level)

**REST**
- `POST /auth/login`
- `POST /main-admin/users` — create user (Main-Admin only)
- `PATCH /main-admin/users/{id}` — update team / status / team-leader flag (Main-Admin only)
- `PATCH /main-admin/users/{id}/password` — set/reset password (Main-Admin only)
- `GET /main-admin/users` — list all users (Main-Admin only)
- `GET /users` — list all other users, sorted by recent interaction
- `GET /teams` — list all five teams with their current members (powers the sidebar directory accordion; visible to everyone, not access-gated — actual team chat access still requires membership or Main-Admin)
- `GET /messages/dm/{user_id}` — DM history
- `GET /messages/team/{team}` — team chat history, scoped to the caller's own `TeamMembership` window(s) — **except Main-Admin, who can access any team's full history without a membership check**
- `POST /messages/{id}/attachments` — upload file, queued for ClamAV scan, rejected upfront if over the team's current limit
- `GET /attachments/{id}` — download, blocked unless `scan_status == clean`
- `PATCH /teams/{team}/settings` — update `max_file_size_mb` (Team Leader for own team, Main-Admin for any)

**Realtime (Socket.IO)**
- `message:send`
- `message:receive`
- `message:read` (drives the seen indicator)
- `unread:update`

---

## 8. Build Order

1. **Auth + User model** — Main-Admin/Employee, team enum, `is_team_leader`, bcrypt password hashing, login endpoint
2. **Main-Admin endpoints** — create/edit/disable users, assign teams, password reset
3. **TeamMembership logging** — write a join/leave row every time a user's team changes; backfill an initial row on user creation
4. **Messaging (REST first)** — DM history, team chat history scoped via TeamMembership, send endpoints, no realtime yet
5. **Realtime layer** — Socket.IO for live delivery, seen-indicator events, unread counts
6. **File attachments** — upload endpoint, `TeamSettings` limit check, ClamAV scan pipeline, gated downloads
7. **Frontend** — sidebar (DMs + team chat), message thread with edit/delete/seen ticks, file upload/preview, Main-Admin panel
8. **Deployment** — Docker Compose (FastAPI, Postgres, Nginx) on the Ubuntu VPS; Nginx configured for large uploads + WebSocket upgrade
9. **(Later) Electron wrapper** — package the built frontend, point at the hosted backend URL

---

## 9. Examples — Want vs. Don't Want

**Want:**
- A brand-new employee has zero access until Main-Admin creates their account.
- An Employee's sidebar shows everyone else, most-recently-messaged first, never themselves.
- Only `team_legal` members can read/post in the Legal team chat.
- A person removed from `team_legal` can still scroll back through messages from
  while they were a member — nothing before they joined, nothing after removal.
- DMs show a seen tick once the recipient opens the message.
- Files of any type up to 500MB upload by default; `team_ai`'s Team Leader can
  raise that to their own ceiling if they regularly share larger files.
- Every upload is malware-scanned before anyone can download it.
- A forgotten password is fixed by Main-Admin generating a new one — never by an
  automated email link or by anyone viewing the old password.
- Main-Admin can open and post in the Legal team chat, the SEO team chat, or any
  other team's chat at any time, without needing to be a member of that team.
- Any employee can expand the "SEO" dropdown in their sidebar to see who's on
  that team, even if they're not on it themselves, and click a name there to
  start a DM — but they can't open the SEO team chat itself unless they're
  actually a member (or Main-Admin).

**Don't want:**
- Any public sign-up form, anywhere.
- `hr_admin` team members getting Main-Admin-level powers.
- Users seeing themselves in their own sidebar.
- Voice/video call UI anywhere in v1.
- Anyone reading a team chat for a team they were never part of during that time window.
- An infected file becoming downloadable before scanning completes.
- A Team Leader raising their limit high enough to fill the shared disk.
- Storing or exposing plaintext passwords anywhere, including to Main-Admin.

---

## 10. Known Defaults / Assumptions (confirm if wrong, otherwise proceed)

- Removed-from-team users keep their team chat in the sidebar as a **read-only
  archive** rather than it disappearing.
- Team Leader file-size ceiling is capped at **2-3GB** given current 200GB disk;
  revisit once the VPS is upgraded.
- Exact employee headcount hasn't been specified — architecture doesn't change
  either way at small-to-medium scale.
- "Almost all rooms" for Main-Admin is implemented as **all team chats without
  exception** (all five teams, always visible/postable). Flag if there's a specific
  room or case Main-Admin should NOT have access to — the current spec treats
  Main-Admin's access as total.

---

## 11. Status

- [x] Full feature scope agreed and finalized
- [x] Roles clarified (Main-Admin vs. hr_admin team tag)
- [x] Data model finalized, including TeamMembership for scoped history
- [x] Tech stack finalized
- [x] Password policy finalized (Main-Admin reset-only, no retrieval)
- [x] Server specs noted (Ubuntu, 16GB RAM, 200GB disk — beginner setup, upgradeable)
- [ ] Scaffolding started
