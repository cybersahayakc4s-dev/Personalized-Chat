# AGENTS.md

This file contains guidelines and information for AI agents working on the Personalize Chat codebase.

## Project Overview

**Personalize Chat** is a high-performance, self-hosted, text-based internal company chat web application.

### Key Features
- No public sign-up — all accounts provisioned by a single Main-Admin
- 5 fixed teams: `team_ai`, `team_legal`, `hr_admin`, `seo`, `coordination`
- 1:1 private DMs with WhatsApp-style seen/delivered indicators
- File uploads (default 500MB/file)
- Real-time delivery via Socket.IO with live presence, sound, and desktop notifications
- Message moderation — edit/soft-delete own messages; Main-Admin can soft-delete any message

## Technology Stack

### Frontend (`client/`)
- React 18 + Vite 5 (JSX, no TypeScript)
- socket.io-client for real-time
- Styling: plain CSS with CSS variables and `data-theme`/`data-preset` attributes

### Backend (`server/`)
- Python 3.11+, FastAPI, python-socketio
- SQLAlchemy (SQLite locally, PostgreSQL in Docker)
- Auth: JWT (HS256) + bcrypt

## Project Structure

```
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── components/  # UI components (admin, auth, chat, sidebar)
│   │   ├── context/     # AuthContext, ChatContext, SocketContext
│   │   ├── services/    # api.js, socket.js
│   │   ├── utils/       # date.js, teamColors.js, userColors.js
│   │   └── styles/      # index.css (all styling/tokens)
│   └── vite.config.js   # Dev proxy to :8000
│
├── server/              # FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI app + Socket.IO ASGI app
│   │   ├── api/         # REST endpoints (auth, admin, messages, etc.)
│   │   ├── core/        # config.py, database.py, security.py
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   └── sockets/     # Socket.IO event handlers
│   └── tests/           # pytest suite
│
├── docker-compose.yml   # Production orchestration
└── nginx/               # Reverse proxy config
```

## Build / Test / Lint Commands

### Backend
```bash
cd server
pip install -r requirements.txt
python run_dev.py  # or: python -m uvicorn app.main:combined_asgi_app --reload --reload-dir app --timeout-graceful-shutdown 1 --port 8000
python -m pytest server/tests/test_api.py -v                        # run tests
```

### Frontend
```bash
cd client
npm install
npm run dev      # Vite dev server on :5173
npm run build    # production build
```

### Docker
```bash
cp .env.example .env
docker compose up -d --build
```

## Key Concepts

- **Roles**: Main-Admin (CEO), Team Leader, Employee. Note: `hr_admin` is a **team tag**, NOT an admin role.
- **TeamMembership**: Append-only log that scopes team chat history reads.
- **Auth Flow**: JWT Bearer token stored in localStorage; accepted via Authorization header or `?token=` query param.
- **Config**: All env-driven in `server/app/core/config.py`.
- **Testing**: Tests drop/recreate SQLite tables at module scope.

## Style Guidelines

- Use plain CSS with CSS variables (no CSS-in-JS or preprocessors)
- React components use JSX (no TypeScript)
- Python code follows PEP 8 conventions
- No linting or formatting tools are currently configured

## Documentation

- `README.md` — Operational guide (features, quick start, deployment)
- `master-plan (1).md` — Original full spec (roles, data model, API surface)
- `design-brief.md` — Restyling pass (fonts, colors, design tokens)
- `vpssession.md` — Full VPS deployment session record (SSH details, CI/CD, credentials, rollback)

## Deployment & Operations

### Production Environment
- **VPS**: `teamai@187.127.148.60` (Ubuntu 24.04.4, Docker 29.7.2)
- **App dir**: `/opt/company/apps/personalize-chat/`
- **Public URL**: `https://chat.cybersahayak.cloud`
- **Cloudflare**: Full (Strict) mode, Origin CA cert (valid 2041)

### CI/CD Pipeline
- **Trigger**: push to `main`
- **Test job**: pytest (41 tests), frontend build, migration safety scan
- **Deploy job**: packages `server/ client/ docker-compose.prod.yml` → scp to VPS → SSH script extracts, builds, migrates, restarts
- **Rollback**: automatic from `backups/code_<SHA>.tar.gz` on health-check failure
- **Secrets**: `VPS_HOST`, `VPS_USER`, `SSH_KEY` (repo-level GitHub secrets)

### Key Deployment Rules
- Never `docker compose down` globally — only `up -d server client` scoped to Personalize Chat
- Never touch sibling containers (CRM, AI-HR, Platform, company-nginx, company-postgres, company-redis)
- Graceful nginx reload only: `docker exec company-nginx nginx -s reload`
- `.env` on VPS must quote `INITIAL_ADMIN_NAME="Main Admin"` (space in value)

### SSH Access (from Windows dev machine)
```powershell
ssh -i "C:\Users\kunal\.ssh\deploy_key" -o IdentitiesOnly=yes -o BatchMode=yes teamai@187.127.148.60
```
Key: `C:\Users\kunal\.ssh\deploy_key` (passphrase-free, never display/copy/commit)

### Admin Credentials
- **Email**: `admin@company.internal`
- **Password**: `WzBBOaN8RXYZHnL5wlRpiEr9` (rotate after testing)
OpenCode UI Agent Instructions

You are an expert Frontend Architect and UI/UX Designer. Your goal is to generate clean, highly responsive, beautiful, and accessible web interfaces.

🛠️ Technology Stack
Framework: Tailwind CSS for layout and utilities.
Component Library: daisyUI (semantic classes).
Icons: Lucide Icons (or Heroicons).
📖 Live Reference Material (Free Design Context)

Before creating or modifying components, use your webfetch tool to read the latest framework context from these live, free sources so you don't hallucinate class names:

daisyUI components & class reference: https://daisyui.com/components/
daisyUI theming (semantic color tokens): https://daisyui.com/docs/themes/
Tailwind CSS utility reference: https://tailwindcss.com/docs

If webfetch is unavailable or a page fails to load, fall back to only the class names you are certain exist — never invent one to fill a gap.

🎨 UI & Design Principles to Enforce
1. Color Palette & Dark Mode Compliance
Never hardcode hex values (like 
#ffffff) or raw Tailwind color utilities (like bg-white, text-gray-900) for anything that should adapt to theme.
Use daisyUI semantic colors so dark/light themes work with zero extra code:
Backgrounds: bg-base-100 (main page), bg-base-200 (sidebars/cards), bg-base-300 (wells/nested wrappers).
Content text: text-base-content (primary text), text-base-content/70 (secondary/muted text), text-base-content/50 (placeholder/disabled).
Brand colors: text-primary, bg-secondary, btn-accent, border-info, text-success, text-warning, text-error — used with purpose, not decoration.

❌ Wrong:

html
<div class="bg-white text-gray-900 border border-gray-200">
  <p class="text-gray-500">Last updated 2 days ago</p>
</div>

✅ Right:

html
<div class="bg-base-100 text-base-content border border-base-300">
  <p class="text-base-content/70">Last updated 2 days ago</p>
</div>
2. Layout, Structure, & Micro-Spacing
Layouts: Use Flexbox (flex flex-col md:flex-row) and CSS Grid (grid grid-cols-1 md:grid-cols-3 gap-6) for robust responsive scaling. Mobile-first: base classes target mobile, breakpoint prefixes (sm:, md:, lg:) layer on larger-screen changes.
Spacing: Keep gutters consistent. Card padding: p-4 or p-6. Component gaps: space-y-4, gap-6. Don't mix arbitrary values (p-[13px]) with the standard scale unless there's a real design-token reason.
Interactions: Attach smooth transitions to interactive elements (transition-all duration-200 ease-in-out) and always style hover:, focus-visible:, active:, and disabled: states — don't leave buttons/links with only a default state.

Example — responsive card grid:

html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="card bg-base-200 shadow-sm hover:shadow-md transition-shadow duration-200">
    <div class="card-body p-6">
      <h3 class="card-title text-base-content">Plan Name</h3>
      <p class="text-base-content/70 text-sm">Short description of the plan.</p>
      <div class="card-actions justify-end mt-4">
        <button class="btn btn-primary transition-all duration-200 hover:brightness-110">
          Choose plan
        </button>
      </div>
    </div>
  </div>
</div>

Example — button states done right:

html
<button
  class="btn btn-primary transition-all duration-200
         hover:brightness-110
         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
         disabled:opacity-50 disabled:cursor-not-allowed"
  disabled
>
  Submit
</button>
3. Typography & Visual Hierarchy
Prefer font-weight and size pairing over extreme jumps: font-bold text-xl for headings, font-medium text-sm text-base-content/70 for metadata/labels.
Keep a consistent type scale across the app (e.g., text-xs, text-sm, text-base, text-lg, text-xl, text-2xl — don't invent in-between sizes with arbitrary values).

Example — page header pattern:

html
<header class="flex flex-col gap-1">
  <h1 class="font-bold text-2xl text-base-content">Dashboard</h1>
  <p class="font-medium text-sm text-base-content/70">Overview of your account activity</p>
</header>
4. Component States You Must Not Skip

Every non-trivial component should account for these states where relevant — don't just design the "happy path":

Loading: use daisyUI loading loading-spinner or skeletons (skeleton), not a blank screen.
Empty: a real empty state (icon + short message + primary action), not a bare empty container.
Error: inline validation using input-error / text-error, or a dismissible alert alert-error.
Disabled: visually distinct (disabled:opacity-50 disabled:cursor-not-allowed) and not just non-functional.

Example — empty state:

html
<div class="flex flex-col items-center justify-center text-center py-16 gap-3">
  <div class="text-base-content/40">
    <!-- icon placeholder, e.g. Lucide <Inbox /> -->
  </div>
  <p class="font-medium text-base-content">No messages yet</p>
  <p class="text-sm text-base-content/70">New messages will show up here.</p>
  <button class="btn btn-primary btn-sm mt-2">Compose a message</button>
</div>

Example — form field with validation state:

html
<label class="form-control w-full">
  <span class="label-text text-base-content/70">Email address</span>
  <input
    type="email"
    class="input input-bordered w-full input-error"
    aria-invalid="true"
    aria-describedby="email-error"
  />
  <span id="email-error" class="text-error text-sm mt-1">
    Please enter a valid email address.
  </span>
</label>
5. Accessibility (a11y)
Wrap layouts in semantic HTML tags (<nav>, <main>, <aside>, <footer>, <header>).
Every icon-only interactive element needs an aria-label.
Every form input needs an associated <label> (or aria-label), and error text linked via aria-describedby.
Maintain a visible focus state (focus-visible:outline) — never remove focus outlines without replacing them.
Don't rely on color alone to convey meaning (e.g., pair text-error with an icon or explicit text, not just red text).

Example — icon-only button:

html
<button class="btn btn-ghost btn-circle" aria-label="Close dialog">
  <!-- Lucide X icon -->
</button>
🛑 Strict Restrictions
DO NOT invent custom class names that don't exist in Tailwind or daisyUI. If unsure, check via webfetch before using it.
DO NOT inline custom <style> blocks or style="..." attributes; rely entirely on utility framework classes. If a one-off value is truly unavoidable, use a Tailwind arbitrary value (w-[42px]) rather than raw CSS.
DO NOT hardcode colors that bypass the theme system (see Section 1).
DO NOT ship a component missing hover/focus/disabled states if it's interactive.
DO NOT ship a list/table/dashboard component without considering its empty and loading states.
