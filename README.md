# Personalize Chat — Internal Company Chat System

A high-performance, self-hosted, text-based internal chat web application built with a **React + Vite** frontend, a **FastAPI + Socket.IO** backend, and **SQLAlchemy** database persistence (PostgreSQL / SQLite).

---

## 🌟 Key Features

- **No Public Sign-up**: Accounts are provisioned and managed strictly by the top-level **Main-Admin** (CEO).
- **5 Fixed Teams**:
  - `team_ai` (AI & Innovation)
  - `team_legal` (Legal Counsel)
  - `hr_admin` (HR & Management — normal employees, not system admins)
  - `seo` (Search & Growth)
  - `coordination` (Operations & Coordination)
- **1:1 Direct Message Privacy**: Strictly confidential between the two participants. Main-Admin has no backdoor access to spy on employees' private DMs.
- **WhatsApp-Style Team Scoping**: An append-only `TeamMembership` log ensures that employees can only view team messages sent during their actual membership window.
- **Archived Team Chats**: Reassigned employees can view past team history in a dedicated "Archived" read-only section.
- **File Upload Limits & Ceilings**: Default 500MB per file. Team Leaders can raise their team's limit up to a hard ceiling (default 2GB), and Main-Admin can override ceilings globally or per team.
- **Real-Time Delivery & Seen Indicator**: Instant WebSocket delivery via Socket.IO with WhatsApp-style double ticks (delivered vs. seen).
- **Live Online Presence**: Green dot presence indicators for active colleagues.
- **Sound & Desktop Alerts**: Subtle in-app chime synthesizer + HTML5 Web Notifications when tab is minimized.
- **Message Moderation**: Users can edit or soft-delete their own messages anytime. Main-Admin can soft-delete any message for moderation (*"Message deleted by Admin"*).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**

### 1. Configure Environment & Start FastAPI Backend
```bash
# Copy example environment and set secure credentials
cp .env.example .env

# Generate a high-entropy secret key:
# openssl rand -hex 32

cd server
pip install -r requirements.txt
python -m uvicorn app.main:combined_asgi_app --reload --port 8000
```
*On first boot, the system automatically creates the database tables and bootstraps the initial Main-Admin account using the values configured in `.env` (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`).*

### 2. Start React Frontend
```bash
cd client
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser and sign in with your configured Main-Admin credentials.

---

## 🧪 Automated Testing

Run the comprehensive pytest suite covering authentication, 1:1 DM privacy, WhatsApp-style membership scoping, and Team Leader limit enforcement:
```bash
python -m pytest server/tests/test_api.py -v
```

---

## 🐳 Production Deployment (Ubuntu VPS with Docker Compose)

The repository includes a production-ready `docker-compose.yml` orchestrating PostgreSQL, FastAPI, and Nginx.

```bash
# Clone the repository on your Ubuntu VPS
git clone <repo-url> /opt/personalize-chat
cd /opt/personalize-chat

# Customize credentials if desired
cp .env.example .env

# Launch the entire stack
docker compose up -d --build
```
Nginx is configured to serve the built React SPA on port 80/443, proxy `/api` and `/socket.io`, and allow large streaming file uploads matching the application leader ceiling (`client_max_body_size 2048M;`).
