# PRE-DEPLOYMENT AUDIT REPORT
**Personalize Chat: Dead Code, Hardcoded CSS / Layout Values, and Bug Hunt**
**Generated:** 2026-09-15  
**Audit Scope:** Full repository (Frontend `client/` + Backend `server/`)  
**Mode:** Read-Only Audit (Findings documented for review; no modifications applied)

---

## EXECUTIVE SUMMARY

A comprehensive static and dynamic pre-deployment audit was conducted across all frontend components, backend endpoints, Socket.IO event managers, configuration profiles, and database schemas. 

Key high-level observations:
1. **Dead Code & Orphaned Connections:** Multiple entire components (`SearchModal`, `EmptyState`, `MessageSkeleton`, `HomePage`, `MembersDrawer`) are dead code. Several components (`UnauthorizedModal`, `PinnedDrawer`) have event triggers implemented in context but are **never mounted into the DOM in `App.tsx`**, rendering their features inoperable. A shadowed duplicate `@router.get("/search")` endpoint exists in `messages.py`. The entire `client/src_backup` directory remains from prior development phases.
2. **Hardcoded CSS / Multi-Context Layout Risks:** The application relies heavily on fixed pixel widths (`w-[270px]`, `w-80` [320px], `w-[350px]`, `min-w-[260px]`, `max-w-4xl`) and desktop-oriented breakpoints. In a small fixed-corner Electron widget (~300–350px wide), the header, search bars, sidebars, and admin tables suffer severe horizontal clipping, content squash, and layout breakage. Furthermore, no element defines `-webkit-app-region: drag`, preventing window dragging in borderless Electron frames.
3. **Bugs & Edge Cases:** A critical privacy bug was uncovered in backend `GET /api/messages?receiver_id=...` where Main-Admin queries leak all conversations involving that recipient across all other employees. In the frontend, emoji reaction user matching compares string IDs (`"usr_1"`) against backend integer IDs (`1`), preventing reactions from ever showing as active. Unhandled promises in admin deletion silently mask API failures. `Avatar.tsx` lacks defensive null-checks on `user.name`, risking crash-to-blank on edge-case data.

---

# PART 1: DEAD CODE & ORPHANED CONNECTIONS

### 1.1 Unused & Orphaned Components

| File | Item | Status / Description | Verdict |
|---|---|---|---|
| `client/src/components/modals/UnauthorizedModal.tsx` | Component `<UnauthorizedModal />` | Triggered by `openUnauthorizedModal` in `ChatContext` (called by `CommandPalette`), but **never imported or rendered in `App.tsx`** or any parent. When a user clicks a restricted channel, nothing displays. | **(c) Unclear / Needs Human Decision** (Should likely be mounted in `App.tsx`) |
| `client/src/components/chat/PinnedDrawer.tsx` | Component `<PinnedDrawer />` | Toggled by `setPinnedDrawerOpen` in `ChatArea.tsx` and `RightSidebar.tsx`, but **never imported or rendered anywhere in the DOM**. Clicking the pin icon in the header does nothing. | **(c) Unclear / Needs Human Decision** (Should either be mounted in `App.tsx` or removed in favor of `RightSidebar`) |
| `client/src/components/chat/MembersDrawer.tsx` | Component `<MembersDrawer />` | Full drawer implementation with status grouping, but never imported or referenced in any file. `RightSidebar` now handles channel members. | **(a) Genuinely unused; safe to remove** |
| `client/src/components/common/EmptyState.tsx` | Component `<EmptyState />` | Defined with suggestion chips and icons, but has 0 imports across the entire repository. | **(a) Genuinely unused; safe to remove** |
| `client/src/components/common/MessageSkeleton.tsx` | Component `<MessageSkeleton />` | Skeleton placeholder component with pulse animations, never imported or used. | **(a) Genuinely unused; safe to remove** |
| `client/src/components/modals/SearchModal.tsx` | Component `<SearchModal />` | Legacy search dialog completely superseded by `CommandPalette.tsx`. `searchModalOpen` is never set to `true`, and component is never rendered. | **(a) Genuinely unused; safe to remove** |
| `client/src/components/home/HomePage.tsx` | Component `<HomePage />` | Landing/login selector screen. In `ChatContext`, `showHomePage` initializes to `false` and all 6 occurrences in code call `setShowHomePage(false)`. Never set to `true`. Contains dangerous hardcoded passwords (`123456`, `Admin@123456`). | **(a) Genuinely unused; safe to remove** |
| `client/src/lib/utils.js` | File `utils.js` | Contains only `export { cn } from "cn"`. The package `"cn"` does not exist in `package.json`, and this file is never imported. | **(a) Genuinely unused; safe to remove** |
| `client/src_backup/` | Directory (20+ files) | Entire backup snapshot of the legacy pre-TypeScript JavaScript codebase (`App.jsx`, `main.jsx`, etc.). | **(a) Genuinely unused; safe to remove** |

---

### 1.2 Frontend API Client Methods (`api.ts`) With No Caller

| File | Method | Status / Description | Verdict |
|---|---|---|---|
| `client/src/services/api.ts` (L301) | `api.searchMessages(q)` | Exact duplicate of `api.search(q)` (L299). `CommandPalette` calls `api.search`. `api.searchMessages` has 0 callers. | **(a) Genuinely unused; safe to remove** |
| `client/src/services/api.ts` (L289) | `api.getThread(id)` | `ThreadDrawer.tsx` filters replies in memory from loaded channel messages. `api.getThread` is never called. Moreover, its return type annotation `{ parent: any; replies: any[] }` conflicts with backend's `List[MessageOut]`. | **(b) Intentionally kept for planned future server-side thread loading** |
| `client/src/services/api.ts` (L291) | `api.getPinnedMessages(team, recipientId)` | `RightSidebar.tsx` and `PinnedDrawer.tsx` filter pinned messages from in-memory arrays. `api.getPinnedMessages` is never called. | **(b) Intentionally kept for future on-demand pin loading** |
| `client/src/services/api.ts` (L230) | `api.switchUser(userId, email)` | Calls `/auth/switch`, an endpoint intentionally deleted from the backend during security hardening to eliminate impersonation backdoors. | **(a) Genuinely unused; safe to remove** |

---

### 1.3 Orphaned Backend Endpoints & Socket Handlers

| File & Line | Endpoint / Handler | Status / Description | Verdict |
|---|---|---|---|
| `server/app/api/messages.py` (L662) | `@router.get("/search")` (`search_messages_and_docs`) | **Shadowed duplicate route.** Line 230 already defines `@router.get("/search")` (`search_workspace`). FastAPI resolves the first matching route, so L662 is dead code and unreachable. | **(a) Genuinely unused / Dead duplicate** |
| `server/app/api/messages.py` (L81) | `GET /api/messages` (`get_messages`) | Root message list endpoint with cursor pagination (`before_id`, `limit`, `offset`). The frontend only calls `/messages/dm/{userId}` and `/messages/team/{team}`, never `GET /api/messages`. | **(b) Intentionally kept for planned cursor pagination** |
| `server/app/api/messages.py` (L475) | `POST /api/messages/mark-read` | Mark-read endpoint. The frontend marks messages as read strictly over WebSocket (`chat_read`, `team_read`). REST `/mark-read` has 0 callers. | **(a) Genuinely unused; safe to remove** |
| `server/app/api/users.py` (L15) | `GET /api/users/presence` | Returns online users dictionary. The frontend uses real-time Socket.IO events (`presence_get`, `presence:update`) exclusively. REST `/presence` has 0 callers. | **(a) Genuinely unused; safe to remove** |
| `server/app/api/messages.py` (L609) | `GET /api/messages/{message_id}/thread` | Returns thread reply list. Frontend does not call this endpoint (filters client-side). | **(b) Intentionally kept for planned future feature** |
| `server/app/api/messages.py` (L626) | `GET /api/messages/pinned` | Returns pinned messages list. Frontend does not call this endpoint (filters client-side). | **(b) Intentionally kept for planned future feature** |
| `server/app/sockets/manager.py` (L215) | `@sio.event chat_send` | In-memory message sending via Socket.IO with sliding window rate limiting. The frontend sends all messages via REST `POST /api/messages`. This socket handler is never called by any client code. | **(b) Intentionally kept or (a) Redundant dual-path** |
| `server/app/sockets/manager.py` (L393, L407) | `@sio.event typing_start` & `typing_stop` | Handlers exist on server, and client listens to `typing:start` in `ChatContext.tsx`, but `MessageInput.tsx` never emits `typing_start` or `typing_stop`. | **(b) Intentionally kept for planned typing indicators** |

---

### 1.4 Environment Variables & Configuration Mismatches

| Location | Variable / Setting | Finding & Impact | Verdict |
|---|---|---|---|
| `.env.example` (L4) | `ACCESS_TOKEN_EXPIRE_MINUTES=10080` | Value is set to **10,080 minutes (7 days)**. However, `server/app/core/config.py` (L14) defines `ACCESS_TOKEN_EXPIRE_MINUTES: int = 15` for short-lived access tokens alongside refresh tokens. Anyone deploying from `.env.example` breaks the short-lived access token rotation architecture. | **(a) Outdated value; must be changed to 15** |
| `.env.example` | `REFRESH_TOKEN_EXPIRE_DAYS` | Defined in `config.py` (L15, default 60) and utilized in `auth.py`, but **completely omitted from `.env.example`**. | **(b) Missing configuration reference** |
| `server/app/core/config.py` (L21) | `RATE_LIMIT_ENABLED` | Defined in `Settings`, but never referenced in `server/app/core/limiter.py` or anywhere else. SlowAPI rate limiting is always hard-enabled. | **(a) Unused config setting** |
| `docker-compose.yml` (L29-36) | `ALLOWED_ORIGINS`, `ENVIRONMENT` | `server` container does not pass `ALLOWED_ORIGINS` or `ENVIRONMENT=production`. In production, `config.py` has a validator requiring production domains if `ENVIRONMENT=production`. | **(b) Incomplete orchestration config** |
| `client/Dockerfile` (L14) | `COPY ../nginx/default.conf ...` | In `docker-compose.yml`, the build context is `./client`. Docker cannot access `../nginx` outside its context. Standard `docker compose build` will fail unless context is changed to root `.`. | **(a) Broken Dockerfile build instruction** |
| `client/vite.config.ts` (L26-29) | Proxy `/uploads` | Proxies `/uploads` to port 8000. Attachments are authenticated and served via `/api/attachments/{id}/view`, not raw static `/uploads`. | **(a) Stray proxy rule** |

---

### 1.5 Leftover Code & Insecure Fallback References

| File & Line | Item | Description | Verdict |
|---|---|---|---|
| `client/src/context/ChatContext.tsx` (L1650) | Hardcoded dev passwords | `const password = targetUser.role === 'main_admin' ? 'Admin@123456' : '123456';` left in `switchUser` fallback block. | **(a) Insecure dev leftover; must be removed** |
| `client/src/context/ChatContext.tsx` (L1655) | `setStoredToken(...)` | In `switchUser` fallback, calls single-token setter `setStoredToken(res.access_token)` instead of `setStoredTokens(res.access_token, res.refresh_token)`, losing refresh token synchronization. | **(a) Outdated auth flow reference** |
| `client/src/context/ChatContext.tsx` (L2124) | `password: userData.password \|\| 'Cyber@123456'` | Hardcoded fallback password in `createUser`. While admin can specify a password, silent fallback to a known hardcoded password is an operational risk. | **(c) Needs Human Decision** |

---

# PART 2: HARDCODED CSS & MULTI-CONTEXT LAYOUT AUDIT

Contexts evaluated:
1. Standard desktop browser window (1200px+)
2. Resizable desktop window (600px - 1000px)
3. **Fixed-corner Electron widget window (~300px - 350px wide)**
4. Frameless / borderless Electron container

### Severity Matrix

| Component | File & Line | Current Value | What Breaks in Small Window (~300px Widget) / Electron | Severity |
|---|---|---|---|---|
| **Sidebar** | `client/src/components/sidebar/Sidebar.tsx` (L113) | `w-[270px]` | In a 300px widget, the sidebar occupies 90% of the entire window width. If left open or opened statically on desktop viewports (`lg:static`), it leaves only 30px for the chat area, completely crushing it off-screen. | **HIGH** |
| **In-Chat Search Bar** | `client/src/components/chat/InChatSearchBar.tsx` (L122) | `min-w-[260px]` | Container has `px-4` (32px padding). With `min-w-[260px]`, the search input alone demands 292px. Navigation controls (up/down/match count/close) wrap onto 2-3 vertical lines, overlapping and hiding the top messages. | **HIGH** |
| **ChatArea Header Actions** | `client/src/components/chat/ChatArea.tsx` (L327-440) | 4 action buttons (`w-8 h-8` each) + `gap-2` + avatar (`w-9 h-9`) + hamburger button | Total minimum horizontal width required is >340px. In a 300-320px widget, the title and handle are crushed to 0px width, causing severe visual clipping and push-out. | **HIGH** |
| **Message Action Menu** | `client/src/components/chat/MessageItem.tsx` (L712) | `absolute right-4 top-2 hidden group-hover:flex` (~130px wide) | On a 300px widget with 88% max message bubble width, hovering a message renders the 130px action bar directly over the message text, obscuring content. On touch or non-hover windows, it cannot be opened at all. | **HIGH** |
| **Composer Formatting Toolbar** | `client/src/components/chat/MessageInput.tsx` (L421-488) | 8 buttons (`w-6` each) + gaps + "Synced" indicator (70px) | Total toolbar width is ~315px with `overflow: visible` (no `overflow-x-auto`). In a 300px widget, buttons overflow horizontally or collide with the "Synced" badge. | **HIGH** |
| **Mention Autocomplete Popover** | `client/src/components/chat/MessageInput.tsx` (L367) | `w-72` (288px) | Pinned `left-0` with composer padding. In a 300px window, 288px overflows the right edge of the widget container. | **HIGH** |
| **Admin Console Table** | `client/src/components/admin/AdminConsoleModal.tsx` (L886) | `<div className="rounded-xl border overflow-hidden">` (no `overflow-x-auto`) | Table contains 5 columns (`User`, `Role`, `Team`, `Presence`, `Actions`). In a narrow or widget window, `overflow-hidden` truncates the table without horizontal scrolling, making the Action buttons (Reset password, Suspend, Delete) inaccessible. | **HIGH** |
| **Command Palette Padding** | `client/src/components/modals/CommandPalette.tsx` (L562) | `pt-16 sm:pt-20 px-4` | Fixed 64px top padding. In a 300x400 widget window, this pushes the modal 64px down, leaving almost no height for search results before hitting the window boundary. | **HIGH** |
| **Pinned Drawer & Members Drawer** | `client/src/components/chat/PinnedDrawer.tsx` (L27), `MembersDrawer.tsx` (L87) | `w-80 lg:w-[360px]` | `w-80` is 320px. In a 300px widget, the drawer is wider than the entire viewport (320px > 300px). | **HIGH** |
| **Electron Window Dragging** | Whole frontend | No `-webkit-app-region: drag` | In a frameless/borderless Electron window, there is no title bar and no element configured as draggable. Users cannot drag or move the widget across their monitors. | **HIGH** |
| **Z-Index Layering Collisions** | `Toast.tsx` (L24), `QuickReplyPopup.tsx` (L63), Modals | `z-50` shared across all overlays | `ToastContainer` and `QuickReplyPopup` are both `fixed bottom-5 right-5 z-50`. Toasts render directly over the quick reply popup. Modals also share `z-50`, causing modal backdrops and toast alerts to fight for stacking precedence. | **MEDIUM** |
| **Attachment Filenames in Bubbles** | `client/src/components/chat/MessageItem.tsx` (L538, L588, L635) | `max-w-[200px]`, `max-w-[220px]` | In a small message bubble, a 220px filename label plus file size badge and download icon causes horizontal overflow beyond the bubble border. | **MEDIUM** |
| **InChatSearchBar Dark Theme** | `client/src/components/chat/InChatSearchBar.tsx` (L119, L139) | `bg-slate-50`, `bg-white`, `text-slate-900` | Ignores dark theme CSS variables / `data-theme="slate"`, displaying a stark white box in dark mode. | **MEDIUM** |
| **RightSidebar Mobile Overlay** | `client/src/components/chat/RightSidebar.tsx` (L107) | `w-full sm:w-80 lg:w-[350px]` | Under 640px, it takes 100% of the screen. In a 300px widget, opening conversation details completely covers the chat view without split-screen capability. | **MEDIUM** |
| **QuickReplyPopup Offsets** | `client/src/components/chat/QuickReplyPopup.tsx` (L63) | `bottom-5 right-5` (20px right & bottom) | In a 300px widget, reduces available width to 260px and directly covers the message input box. | **LOW** |

---

# PART 3: BUG HUNT

### 3.1 Race Conditions in State Updates

#### Bug 3.1.1: Uncancelled Remote Search Requests in Command Palette
- **File:** `client/src/components/modals/CommandPalette.tsx` (L114-128)
- **Trigger:** User types rapidly in the Command Palette search input (e.g. typing "project" character by character).
- **Issue:** While a 200ms debounce timer exists, `api.search(trimmed)` does not pass an `AbortSignal`. If request A (search "pro") takes 400ms and request B (search "project") takes 150ms, request A resolves *after* request B and overwrites `remoteResults` with stale query results.
- **Severity:** **HIGH** (Happens regularly on slower network connections).

#### Bug 3.1.2: Optimistic Message Signature Collision on Identical Messages
- **File:** `client/src/context/ChatContext.tsx` (L1106-1132)
- **Trigger:** A user sends two identical short messages in quick succession (e.g. "yes", "ok", or 👍).
- **Issue:** The incoming socket handler searches for matching optimistic messages via `m.content.trim() === incoming.content.trim()`. Because `clientId` is generated on client but not echoed back identically by older endpoints, matching by content signature alone can cause the first server confirmation to consume or delete both pending messages.
- **Severity:** **MEDIUM** (Edge case when sending identical rapid affirmations).

---

### 3.2 Memory Leaks & Event Listener Cleanup

#### Bug 3.2.1: Blank Socket Event Off Calls Removing Global Handlers
- **File:** `client/src/context/ChatContext.tsx` (L1399-1401)
- **Trigger:** When `token` changes or `ChatContext` unmounts.
- **Issue:**
  ```ts
  socket.off('connect');
  socket.off('disconnect');
  socket.off('connect_error');
  ```
  Calling `socket.off('connect')` without specifying the function reference removes **all** listeners on the singleton socket for that event, including internal listeners registered by `socket.ts` (e.g. silent token refresh error handlers).
- **Severity:** **MEDIUM** (Can disable silent refresh listeners if context re-mounts).

#### Bug 3.2.2: Global Cmd+F Interception Without Input Focus Guard
- **File:** `client/src/components/chat/ChatArea.tsx` (L217-226)
- **Trigger:** Pressing Cmd+F / Ctrl+F while typing inside an input field within `AdminConsoleModal` or `UserProfileModal`.
- **Issue:** The listener has no check for `document.activeElement` or whether a modal is currently open. It unconditionally intercepts Cmd+F and toggles the in-chat search bar behind the modal.
- **Severity:** **LOW** (Minor UX annoyance).

---

### 3.3 Pagination & Cursor Boundary Errors

#### Bug 3.3.1: Zero-Value Evaluation in `before_id` Cursor Pagination
- **File:** `server/app/api/messages.py` (L158)
- **Trigger:** Passing `before_id=0`.
- **Issue:**
  ```python
  if before_id:
      query = query.filter(Message.id < before_id)
  ```
  In Python, `0` is falsey. If a client initiates pagination using `0`, the cursor filter is skipped, returning the latest 50 messages instead of an empty slice.
- **Severity:** **LOW** (Database IDs start at 1, but API boundary contracts should use `if before_id is not None:`).

#### Bug 3.3.2: Critical Security Isolation Leak in Main-Admin `receiver_id` Query
- **File:** `server/app/api/messages.py` (L149-155)
- **Trigger:** Main-Admin queries `GET /api/messages?receiver_id={user_id}`.
- **Issue:**
  ```python
  if not current_user.is_main_admin and receiver_id != current_user.id:
      query = query.filter(
          or_(
              and_(Message.sender_id == current_user.id, Message.receiver_id == receiver_id),
              and_(Message.sender_id == receiver_id, Message.receiver_id == current_user.id)
          )
      )
  else:
      query = query.filter(
          or_(
              Message.sender_id == receiver_id,
              Message.receiver_id == receiver_id
          )
      )
  ```
  When `current_user.is_main_admin` is true, the `else` branch executes. This matches **every single message where `receiver_id` was sender OR receiver across the entire company** — including private 1:1 conversations between employee A and employee B. This directly violates the core application guarantee: *"1:1 direct messages are strictly encrypted/isolated between participants; Admins cannot read private employee conversations."*
- **Severity:** **CRITICAL / SECURITY** (Leaks private employee direct messages to Main-Admin via REST API).

#### Bug 3.3.3: Total Absence of Frontend Pagination (Unbounded DOM Ingestion)
- **File:** `client/src/context/ChatContext.tsx` (L1468, L1484)
- **Trigger:** Opening any channel or DM with an active history.
- **Issue:** The frontend never uses `GET /api/messages` (the only endpoint with pagination). It calls `/messages/dm/{userId}` and `/messages/team/{team}`, both of which execute `.all()` on the database. In an enterprise workspace with 10,000 messages, all 10,000 rows are transferred over JSON and rendered into the React DOM at once, resulting in browser freeze and memory exhaustion.
- **Severity:** **HIGH** (Scalability bottleneck in real workspace use).

---

### 3.4 Unhandled Promises & Silent Failures

#### Bug 3.4.1: Silent Failure on User Deletion in Admin Console
- **File:** `client/src/components/admin/AdminConsoleModal.tsx` (L185) & `ChatContext.tsx` (L2173-2202)
- **Trigger:** Main-Admin attempts to delete a user, but backend returns an error (e.g. 403 Forbidden or 404).
- **Issue:** `deleteUser` in `ChatContext.tsx` catches the API error internally and returns `{ success: false, error: err.message }` instead of throwing. `handleConfirmDeleteUser` in `AdminConsoleModal` calls `await deleteUser(...)` inside a `try/catch` block, but **never checks `res.success`**. Because no exception was thrown, the modal closes, displays no error message, and the operator assumes the user was deleted when they were not.
- **Severity:** **HIGH** (Silent administrative failure; operator misled).

#### Bug 3.4.2: Unhandled Rejections in Auth Login Flow
- **File:** `client/src/context/ChatContext.tsx` (L1709-1735)
- **Trigger:** `api.login` succeeds, but subsequent `api.getMe()` or `api.getUsers()` calls fail due to network timeout or server restart.
- **Issue:** Inside `login`, `await api.getMe()` and `await api.getUsers()` have no `try/catch`. The rejected promise bubbles out uncaught, leaving tokens stored in localStorage while the user profile and channels remain unpopulated.
- **Severity:** **MEDIUM** (Corrupts local application state on intermittent network failure).

---

### 3.5 Inconsistent Null / Undefined Handling

#### Bug 3.5.1: Fatal `TypeError` in `Avatar.tsx` on Undefined / Blank User Name
- **File:** `client/src/components/common/Avatar.tsx` (L25-30)
- **Trigger:** Any message or user item where `user.name` is undefined, `null`, or an empty string `""` (e.g. a deleted user or corrupted database row).
- **Issue:**
  ```ts
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  ```
  If `user.name` is `""`, `"".split(' ')` returns `[""]`. `[""][0][0]` evaluates to `undefined`, and `undefined.toUpperCase()` throws:
  `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`
  Because `Avatar` is rendered across messages, sidebar, modals, and header, this immediately crashes the React component tree into the error boundary.
- **Severity:** **HIGH** (Crashes entire chat viewport if a single message has empty sender name).

#### Bug 3.5.2: Reaction Highlighting Failure Caused by Type Mismatch (`string` vs `number`)
- **File:** `client/src/components/chat/MessageItem.tsx` (L658-660)
- **Trigger:** Any user reacts to a message with an emoji.
- **Issue:**
  ```ts
  const userIds = (Array.isArray(userIdsRaw) ? userIdsRaw : []) as string[];
  const hasReacted = userIds.includes(currentUser.id);
  ```
  Backend returns reaction user IDs as integers (`[1, 2]`), while `currentUser.id` is formatted as `"usr_1"`. `[1].includes("usr_1")` is **always false**. As a result:
  1. The user's active reaction button never lights up blue.
  2. Clicking the reaction button again to "react" actually removes the reaction on the backend because the server sees the user had already reacted.
- **Severity:** **HIGH** (Breaks core interactive reaction toggle UX).

#### Bug 3.5.3: Crash on Attachment Without Name in Right Sidebar
- **File:** `client/src/components/chat/RightSidebar.tsx` (L86, L318)
- **Trigger:** A shared file or attachment has a missing or null `name`.
- **Issue:**
  ```ts
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  ```
  If `file.name` is `undefined` or `null`, `fileName.split` throws `TypeError: Cannot read properties of undefined (reading 'split')`, crashing `RightSidebar`.
- **Severity:** **MEDIUM** (Crashes conversation details drawer on malformed file record).

#### Bug 3.5.4: Unassigned User Team Fallback Masking Database State
- **File:** `client/src/context/ChatContext.tsx` (L228) & `server/app/models/user.py` (L27)
- **Trigger:** User has `team = None` in the database (allowed by SQLAlchemy schema).
- **Issue:** `mapBackendUser` unconditionally defaults `team: (u.team as TeamId) || 'coordination'`. This silently assigns users without a team to the Operations & Coordination department in the frontend, potentially granting them unintended department channel visibility.
- **Severity:** **MEDIUM** (RBAC inconsistency between client state and server database).

---

# AUDIT FINDINGS SUMMARY TABLE

| Part | Finding | Impact | Action Recommended |
|---|---|---|---|
| **1.1** | `UnauthorizedModal` & `PinnedDrawer` not in DOM | Modal triggers do nothing | Mount modals in `App.tsx` or deprecate |
| **1.1** | `HomePage`, `SearchModal`, `MembersDrawer`, `EmptyState`, `MessageSkeleton` | Unused code clutter (~1,500 LOC) | Delete dead components |
| **1.1** | `client/src_backup/` directory | 20+ obsolete JavaScript files | Delete folder |
| **1.2** | `api.searchMessages`, `api.switchUser` | Dead / obsolete client endpoints | Remove methods from `api.ts` |
| **1.3** | Shadowed `@router.get("/search")` in `messages.py` | Line 662 is dead code | Remove duplicate definition |
| **1.3** | REST `POST /mark-read`, `GET /users/presence` | Orphaned backend endpoints | Deprecate or document as headless |
| **1.4** | `.env.example` `ACCESS_TOKEN_EXPIRE_MINUTES=10080` | Breaches 15-min token rotation spec | Fix to `15` |
| **1.4** | `client/Dockerfile` `COPY ../nginx/default.conf` | Docker compose build fails | Fix Docker context / copy path |
| **1.5** | Hardcoded passwords in `ChatContext` fallback | Security risk | Remove fallback backdoor passwords |
| **2** | `w-[270px]`, `min-w-[260px]`, `w-80` across views | Layout breaks in 300px widget | Apply responsive max-widths and scroll |
| **2** | Missing `-webkit-app-region: drag` | Cannot drag Electron widget | Add draggable header utility |
| **2** | `z-50` shared by toasts, quick reply, and modals | Overlap / bleed-through | Establish structured z-index scale |
| **3.1** | Command Palette remote search race condition | Stale search results overwrite newer | Add `AbortController` cancellation |
| **3.3** | Main-Admin `receiver_id` query leak in `messages.py` | Admins can inspect all employee DMs | Scope to `sender_id=admin AND receiver_id=X` |
| **3.3** | Frontend loads entire message history (`.all()`) | DOM freeze on large channels | Connect cursor pagination to frontend |
| **3.4** | Admin user deletion ignores failure response | Silent failure misleading operator | Check `res.success` and display error |
| **3.5** | `Avatar.tsx` crash on null/empty name | App crashes to error boundary | Add safe optional chaining & fallback `'?'` |
| **3.5** | Reaction ID type mismatch (`"usr_1"` vs `1`) | Reaction toggle button never highlights | Normalize ID comparisons in `MessageItem` |

---
*End of Report. Awaiting instructions on which findings to remediate.*
