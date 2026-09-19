# Changelog

All notable changes to **Personalize Chat** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.1] - 2026-09-19

### Fixed
- **Chat Layout & Message Spacing**: Resolved excessive vertical whitespace between messages by tightening grouping margins and nesting reply quote previews and read receipts (seen/delivered ticks) directly inside message cards.
- **Visual Contrast & Polish**: Refined surface background contrast in sidebar and drawer panels for clean legibility across light and dark themes.

---

## [3.1.0] - 2026-09-18

### Added
- **Custom Profile Banners**: Users can now upload and remove custom profile banners (`POST /api/users/me/banner`, `DELETE /api/users/me/banner`). Banners are served with secure caching, automatic MIME/magic-byte validation, and strict `nosniff` headers.
- **Desktop Auto-Updater & System Tray**: Native Electron application now supports automated update checks, background download, installation triggers, and minimization directly to the Windows System Tray with quick notification actions.
- **UI Modernization & Component Primitives**: Added modular UI primitives based on accessible standards, including Avatar, Badge, Button, ScrollArea, Separator, and Tooltip components with streamlined daisyUI integration.
- **Activity Drawer & Modernized Settings**: Introduced an interactive Activity Drawer and an enhanced Settings Modal providing fine-grained desktop preferences and presence management.
- **File Download Helper**: Streamlined attachment download management with proper content-disposition and blob handling (`download.ts`).

### Changed
- **Message Rendering Engine**: Fully replaced legacy `MessageBubble` with the unified, accessible `MessageItem` component featuring enhanced hover actions, integrated thread previews, quote replies, and emoji reaction pickers.
- **Database Schema & Migrations**: Added `banner_url` and `avatar_url` fields to the `users` table and `allow_custom_channels` to `workspace_settings` with idempotent startup schema migrations.
- **Nginx Upload Buffer Capacity**: Increased reverse-proxy upload limit to 3GB (`client_max_body_size 3000M`) to provide overhead for large attachment uploads.

### Security
- **IPC Sender Verification (SEC-IPC-01)**: Hardened Electron desktop IPC handlers (`updater:get-state`, `updater:check`, `updater:install`) to strictly validate frame hierarchy, sender identity, and origin file URL, rejecting malicious or external web callers.
- **CORS Protection Hardening**: Removed unsafe wildcard origin matching in API CORS middleware; enforced strict production domain allowlisting (`https://chat.cybersahayak.cloud`) with credentials protection.
- **Banner File Upload Armor**: Added deep magic-byte inspection (`filetype.guess`), executable file blocklisting (`MZ`, `ELF`, shell scripts), safe UUID filename generation to neutralize path traversal, and strict 10MB upload ceiling.
- **Container Non-Root Execution**: Hardened backend `Dockerfile` to run as an unprivileged non-root system user (`appuser`, UID 1000) with dedicated `.dockerignore` preventing local secrets and cache leakage.

---

## [2.2.0] - 2026-08-15

### Added
- Sovereign Electron desktop packaging with native Windows quick-reply overlays.
- Token refresh rotation with short-lived access tokens and revocable refresh tokens.
- Structured company team hierarchy across 5 fixed teams (`team_ai`, `team_legal`, `hr_admin`, `seo`, `coordination`).
- Real-time Socket.IO messaging with typing indicators, presence, and delivery receipts.
