# Personalize Chat / C4S-Connector - Comprehensive Changelog & Architectural Review

This document provides a detailed breakdown of all changes made across the codebase, including the original issue, rationale, whether the solution was a patch or a root-cause fix, and an honest technical assessment of alternative approaches.

---

## 14. Notification RBAC Enforcement for Announcements, Restriction Banner Contrast & Sender Bubble Color Fix

### What was the issue?
1. **Critical RBAC Flaw on Chrome Notifications**: When an announcement was posted by Main-Admin, employee clients (e.g. Danny) received a Chrome desktop notification with an active **"Reply"** button. If the employee typed into that inline notification reply or used the quick reply popup, the message was dispatched into `#announcements` without checking whether the user was authorized to post in announcements (only CEO/Main-Admin is authorized).
2. **Invisible Yellow Restriction Banner**: The bottom restricted-channel banner (`Channel Access Restricted: Only Main-Admin (CEO) has posting authorization...`) used low-opacity yellow text on a low-contrast background (`text-amber-300` on `bg-amber-500/10`), making it virtually illegible in light mode.
3. **Aggressive Blue Sender Bubble**: The right-aligned sender bubble used a high-saturation, harsh bright blue (`bg-blue-600`) that felt aggressive on the eyes.

### What changes were made?
- **Notification RBAC Enforcement**:
  - In [`client/src/services/desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts), added a `canReply` flag to `IncomingMessageNotificationOptions`. When `canReply === false`, the `"reply"` action button is completely omitted from the notification payload (`actions: [{ action: 'mark_read', title: 'Mark as read' }]`).
  - In [`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx):
    - Added user posting authorization check (`userCanReply`) for incoming messages: `#announcements` strictly permits replies only if `role === 'main_admin'`; `#updates` strictly permits replies only if `role === 'main_admin'` or team leader.
    - Suppressed the `"Quick Reply"` button from in-app toasts for read-only channels.
    - Added strict posting permission checks inside `sendQuickReply` so any attempt by an unauthorized employee to post into `#announcements` or `#updates` via service worker or inline reply is immediately rejected and logged.
  - In [`client/public/sw.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/sw.js), enforced `canReply !== false && targetConvId !== 'c-announcements'` in the background direct API fallback.
- **Restriction Banner Contrast Fix**:
  - In [`client/src/components/chat/MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx), upgraded the restriction banner from washed-out yellow to high-contrast executive amber:
    - Light mode: Solid amber container `bg-[#FEF3C7] border-amber-400 text-[#78350F]` with `bg-amber-200 text-amber-800` icon badge.
    - Dark mode: Deep contrast card `bg-[#2A1D0B] border-amber-600/40 text-amber-200`.
- **Gentle Sender Bubble Color**:
  - In [`client/src/components/chat/MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx), softened the sender bubble color:
    - Light mode: Softened to clean corporate blue `bg-[#2563EB]/90 text-white shadow-xs font-normal`.
    - Dark mode: Softer deep slate-blue `bg-[#1E3A5F]/85 border border-[#3B82F6]/35 text-[#F1F5F9]`.

### Patch vs. Root Cause Fix
- **Root Cause Fix**: Notification action generation, client quick reply routing, and service worker fallbacks now all strictly evaluate and enforce the channel's Role-Based Access Control before generating reply interfaces.

---

## 13. C4S-Connector Rebranding, Left Sidebar UX, Right-Aligned Sent Chats, User Colors & @Mentions

### What was the issue?
1. **Left Panel Congestion & Native White Scrollbar**: The sidebar had an intrusive native white scrollbar and congested padding in dark mode.
2. **Company Logo & App Name**: The sidebar header had a generic SVG icon and displayed `Personalize Chat` and `Enterprise Hub • v2.4`. The requirement was to change the app title to `C4S-Connector`, keep `Cyber Sahayak`, remove `Enterprise Hub`, display the company logo from `Company-profile.jpeg`, and set the version to `v1.3.1`.
3. **Chat Bubble Alignment & System Profile Colors**: All messages were aligned to the left, making it hard to discern sent from received messages. All users had a generic dark blue avatar style without individualized color identities.
4. **Interactive `@` Mentions**: Typing `@` in the chat input or pressing the `@` button did not bring up a clickable member list popup for tagging.
5. **Channel Verification**: Needed confirmation that `#announcements` and `#updates` channels were operating with RBAC permissions and real-time delivery.

### What changes were made?
- **Company Logo & Branding**:
  - Copied `Company-profile.jpeg` to [`client/public/company-logo.jpeg`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/company-logo.jpeg).
  - Updated [`client/index.html`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/index.html) title to `C4S-Connector` and favicon to `/company-logo.jpeg`.
  - Updated [`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx) dynamic document title to `C4S-Connector`.
  - Updated [`client/src/components/sidebar/Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx) header with the logo image, `Cyber Sahayak`, and `C4S-Connector • v1.3.1`.
- **Sidebar Scrollbar & Spacing**:
  - Updated [`client/src/index.css`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/index.css) with `.custom-sidebar-scroll` and dark translucent thumbs (`scrollbar-color: rgba(71, 85, 105, 0.28) transparent`).
  - Replaced native scrollbar in [`Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx) with `.custom-sidebar-scroll`.
- **Right-Aligned Sender Chat & Distinct User Colors**:
  - Updated [`client/src/utils/userColors.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/utils/userColors.js) with `USER_COLOR_PALETTES` (12 curated color palettes with distinct backgrounds, text, borders, and name tints) and `getUserColorProfile()`.
  - Updated [`client/src/components/common/Avatar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/common/Avatar.tsx) to use system-picked user profile colors.
  - Updated [`client/src/components/chat/MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx):
    - When `isOwnMessage === true`, aligns message container to the right (`flex-row-reverse`), sets outgoing bubble styling with blue tint, and aligns action bar to the left.
    - Applies `senderColor` from `getUserColor(sender.id, sender.name)` to the sender's display name.
- **Interactive `@` Mention Autocomplete**:
  - In [`client/src/components/chat/MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx):
    - Added `@` detection in `handleTextChange` to filter eligible members by name or `@handle`.
    - Rendered an elevated autocomplete popover above the input box showing avatars, names, and handles.
    - Added full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Tab`, `Escape`) and mouse selection to insert `@<handle> `.
- **Announcements & Updates Verification**:
  - Verified backend endpoints and ran automated test `test_channel_announcements_and_updates_permissions` (passed 100%).

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Rebranding, deterministic color hashing, right-aligned message layout, custom CSS scrollbars, and full keyboard-navigable autocomplete were implemented directly at the component architecture level.

---

## 1. Message Duplication on Enter Key Press

### What was the issue?
When a user typed a message (e.g. `> yoo` or `1. hiii`) and pressed `Enter`, the message rendered **twice** in the chat stream.
Investigation revealed that the backend database (`server/personalize_chat.db`) only stored a **single** record for each message (e.g., id `26` for `> yoo`, id `27` for `1. hiii`). The duplication was purely on the frontend, caused by two compounding factors:
1. **OS Key Repeat**: Holding or pressing Enter on mechanical/rapid keyboards fired multiple `keydown` events before React could clear input state.
2. **Optimistic UI vs. WebSocket Race**: When `sendMessage` added a temporary optimistic message (`msg-temp-...`), the Socket.IO broadcast (`message:receive`) arrived before or concurrently with the REST API `POST /messages` promise resolution. Because reconciliation relied on exact IDs, the temporary message and confirmed message coexisted in state.

### What changes were made?
- [`MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx):
  - Added an `isSubmittingRef` guard to block concurrent or re-entrant calls within a 350ms throttle window.
  - Added key-repeat suppression in `handleKeyDown`: `if (e.repeat || e.nativeEvent.isComposing) return;`.
- [`ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx):
  - Hardened `socket.on('message:receive')` to match incoming messages with optimistic messages by `${senderId} + ${content.trim()}` and replace them in-place, while removing any duplicate temporary entries.
  - Hardened `sendMessage` promise callback to purge any matching temporary messages when the server response arrives.
- [`ChatArea.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/ChatArea.tsx):
  - Added a `confirmedSignatures` filter in `currentMessages` so any pending `msg-temp-` message matching an already-confirmed message signature is instantly suppressed from rendering.

### Patch vs. Root Cause Fix
- **Keyboard debounce (`isSubmittingRef`, `e.repeat`)**: **Patch**. Protects against OS/browser event timing quirks.
- **Signature-based optimistic message reconciliation**: **Root Cause Fix**. Fixes the lifecycle discrepancy between WebSocket broadcast and REST response resolution.

### Was there a better way to solve this?
- **Yes — Client-Generated Idempotency UUIDs**:
  - The industry-standard pattern (used by Slack, Discord, and Matrix) is for the client to generate a unique UUID `client_message_id` for every send attempt and pass it in the `POST /messages` payload.
  - The backend stores `client_message_id` in the database and includes it in both the REST response and WebSocket payload.
  - Frontend deduplication then becomes deterministic (`m.client_message_id === incoming.client_message_id`), completely eliminating the need for heuristics like comparing sender ID and trimmed content.

---

## 2. Blockquote Formatting & Invisibility in Light Theme

### What was the issue?
1. In the Nordic (white/light) theme, blockquote text (`> text`) was styled with low-contrast muted tokens (`text-slate-300`), making quote text appear as faint, unreadable ghost text against the `#D8DFE7` background.
2. Multi-line blockquotes were split into isolated, chopped-up boxes because the parser processed each line independently.
3. Highlighting text and clicking the Quote button replaced the selection with `> ` instead of quoting the highlighted text.

### What changes were made?
- [`MessageBubble.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageBubble.tsx):
  - Styled quotes with high-contrast text: `style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}` and `text-slate-950 font-medium` in light mode, with a solid `3.5px` emerald border (`border-emerald-600` light / `border-emerald-400` dark) and subtle background pill container (`bg-black/[0.04]` light / `bg-white/[0.06]` dark).
  - Grouped consecutive lines starting with `>` into a single cohesive blockquote container.
  - Polished numbered lists (`1. text`) and bullet items (`- text`) with guaranteed contrast styles.
- [`MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx):
  - Updated `applyFormatting('quote')`: if text is selected, it prefixes each line with `> `; if no selection, it inserts `> ` at the line start.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Corrected both the CSS token contrast failure and the markdown parser's single-line aggregation logic.

### Was there a better way to solve this?
- **AST-Based Markdown Parser (e.g. `remark` / `markdown-it`)**:
  - A dedicated AST parser handles multiline blockquotes, nested quotes, lists, and code fences natively without bespoke regex scanning.
  - However, for this project's lightweight requirements, the regex-based grouping avoids heavy dependencies and maintains fast bundle times.

---

## 3. Workspace Member Discovery & Right Sidebar Scope

### What was the issue?
The Right Sidebar's "Members of the Chat" section filtered members strictly by `u.team === teamChannelTeam`. When viewing a channel like `#team-legal` (which had 0 members), provisioned colleagues assigned to other departments (such as `danny` in `team_ai`) were completely hidden. Furthermore, 1:1 DMs hid the members section entirely. This led to the perception that newly created users were missing from the app.

### What changes were made?
- [`RightSidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/RightSidebar.tsx):
  - Added a segmented control under "Members of the Chat":
    - **Channel (`count`)**: Displays members belonging to the current department channel.
    - **All (`count`)**: Displays all provisioned workspace members.
  - Enabled direct 1:1 DM launching and profile modal inspection for any workspace member from any channel.

### Patch vs. Root Cause Fix
- **Root Cause Fix** for UX discoverability. The data existed in the frontend store (`users`), but the UI artificially constrained user access to channel silos.

### Was there a better way to solve this?
- **Global Command Palette / Dedicated Directory View**:
  - Adding a quick switcher (`Cmd+K` / `Ctrl+K`) or a dedicated "Directory" tab in the left sidebar would be even better for large organizations with hundreds of members.

---

## 4. Real-time User Creation & Admin Console Error Handling

### What was the issue?
1. When Main-Admin created a user via `AdminConsoleModal.tsx`, the backend did not emit a WebSocket event. Other sessions or open tabs did not see the new user until a full page reload.
2. When attempting to create a user with an email that already existed, the backend returned HTTP 400 (`"A user with this email already exists"`), but `createUser` in `ChatContext.tsx` swallowed the error and returned void. The modal closed silently with no error message shown.

### What changes were made?
- [`server/app/api/admin.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/admin.py) & [`server/app/api/auth.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/auth.py):
  - Converted `create_user` and `register` endpoints to `async def` and added real-time WebSocket broadcast: `await sio.emit("user:created", user_data)`.
- [`ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx):
  - Updated `createUser` to return `Promise<{ success: boolean; error?: string }>`.
  - Added a `socket.on('user:created')` listener with proper cleanup on unmount to append newly provisioned users across all active client sessions in real time.
- [`AdminConsoleModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/admin/AdminConsoleModal.tsx):
  - Added `userCreateError` state and rendered a clear error banner above the form when creation fails.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Repaired the missing WebSocket event emission, fixed the swallowed promise rejection, and added explicit error state rendering.

### Was there a better way to solve this?
- **Form-Level Field Validation**:
  - Pre-validating email uniqueness via an asynchronous `check-email` endpoint on blur would prevent form submission altogether when an email conflict exists.

---

## 5. Theme Palette Tuning (Series-C Executive Tokens)

### What was the issue?
Original colors were overly bright and harsh. The light theme used stark, blinding white `#FFFFFF` backgrounds, and the dark theme used high-glare neon navy hues. Buttons and UI elements felt oversized and uncalibrated.

### What changes were made?
- [`client/src/index.css`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/index.css):
  - **Nordic (Light)**: Replaced `#FFFFFF` with a calm, zero-glare executive slate surface (`#D8DFE7`), with subtle cards (`#E8EEF5`) and muted borders (`#C6D0DC`).
  - **Slate / WhatsApp (Dark)**: Toned down navy glare to an obsidian slate palette (`#121620` base, `#182030` cards, `#222C3E` borders).
  - Refined typography weights and button dimensions across all header bars and composers.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Updated the design tokens at the `:root` and theme-class level.

### Was there a better way to solve this?
- Using CSS variables directly mapped to HSL tokens with an automatic lightness-contrast calculator for dynamic theming.

---

## 6. Consolidated 3-in-1 Right Sidebar Panel

### What was the issue?
Pinned messages opened in an isolated side drawer, the members tab showed redundant status information already displayed by presence avatars, and top-bar action buttons were crowded.

### What changes were made?
- [`RightSidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/RightSidebar.tsx):
  - Consolidated into a structured 3-part layout:
    1. **Pinned Messages**: Scrollable list of pinned items.
    2. **Members of the Chat**: Interactive list with Channel / All workspace toggle and 1:1 DM shortcuts.
    3. **Shared Files & Documents**: Clean list view displaying all attachments shared in the conversation.
  - Simplified the chat header to a clean Search icon and Panel toggle.

### Patch vs. Root Cause Fix
- **Root Cause Fix** for application structure and space utilization.

### Was there a better way to solve this?
- An accordion or collapsible panel structure allowing users to minimize any of the three sections.

---

## 7. Message Deletion Confirmation & Moderation Safeguards

### What was the issue?
Clicking "Delete" on a message deleted it immediately without any confirmation prompt. Furthermore, in certain UI states, deleted messages could still enter edit mode.

### What changes were made?
- [`MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx):
  - Added `window.confirm('Are you sure you want to delete this message?')` before invoking `deleteMessage`.
  - Enforced strict read-only mode on soft-deleted messages (`canEdit = !isDeleted && isOwnMessage`).

### Patch vs. Root Cause Fix
- `window.confirm()` is a **Patch** (browser-native prompt). Disabling edit mode on deleted items is a **Root Cause Fix**.

### Was there a better way to solve this?
- **In-App Modal / Undo Toast**:
  - Replacing the native browser dialog with a styled in-app confirmation modal, plus a 5-second "Undo" toast notification before permanently executing the soft-delete.

---

## 8. Dynamic Date Divider Calculation

### What was the issue?
The chat stream showed static placeholder dates (e.g. October 24) instead of the actual date the messages were sent.

### What changes were made?
- [`date.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/utils/date.ts) & [`ChatArea.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/ChatArea.tsx):
  - Implemented dynamic date dividers comparing `getDayKey(prevMsg.timestamp)` with `getDayKey(msg.timestamp)`.
  - Formats headers as "Today", "Yesterday", or formatted dates (`MMMM d, yyyy`).

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Replaced static mock values with dynamic timestamp parsing.

---

---

## 9. Duplicate Global Search Modals on Ctrl+K

### What was the issue?
Pressing `Ctrl+K` opened two search bars stacked on top of each other: an unstyled pitch-dark modal (`SearchModal.tsx`) with hardcoded "Mesh Node #01" branding, and the theme-adaptive Universal Command Palette (`CommandPalette.tsx`). The left sidebar search button only opened `CommandPalette.tsx`.

### What changes were made?
- [`App.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/App.tsx):
  - Removed `<SearchModal />` and its import.
  - Streamlined the global `Ctrl+K` / `Cmd+K` keyboard shortcut to toggle `CommandPalette.tsx`.
- [`SearchModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/SearchModal.tsx):
  - Removed the `Ctrl+K` keydown listener to prevent background triggers.
- [`Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx):
  - Renamed the search trigger button to **"Search workspace..."** with a `Ctrl K` badge and hover animations.
- [`CommandPalette.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/CommandPalette.tsx):
  - Added theme adaptation (`isDark = theme !== 'nordic'`), full keyboard navigation with automated scrolling into view, direct colleague DMs (`createOrOpenDm`), remote database search via `/api/messages/search?q=...`, and scroll-to-message with an amber highlight in `ChatArea.tsx`.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Removed redundant duplicate component and unified the sidebar button and keyboard shortcut to a single source of truth.

---

## 10. User Disappearance & Registration Conflict (Pydantic Presence Enum 500 Error)

### What was the issue?
Users reported that newly provisioned users (such as `danny@example.com`) "disappeared" and the UI showed 0 users, yet attempting to register or provision the email again failed with `"A user with this email already exists"`.
Investigation revealed that:
1. The user was **never deleted** from the SQLite database (`personalize_chat.db`).
2. When a user connected via WebSockets, in-memory presence status updated to `"online"` or `"busy"`.
3. In [`server/app/api/users.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/users.py), `get_colleagues()` set `status = "online"`.
4. In [`server/app/schemas/user.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/schemas/user.py), `UserRecentOut` strictly typed `status: UserStatus` (`"active"` | `"disabled"`). Pydantic raised `ValidationError: Input should be 'active' or 'disabled' [type=enum, input_value='online', input_type=str]`, causing `GET /api/users` to crash with **HTTP 500 Internal Server Error**.
5. Because `GET /api/users` crashed, the client's `ChatContext.tsx` failed to load users from the server and fell back to the single hardcoded default user (`Main Admin`), showing 0 colleagues in the sidebar.

### What changes were made?
- [`server/app/schemas/user.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/schemas/user.py):
  - Updated `UserOut` and `UserRecentOut` to allow `status: Union[str, UserStatus] = "active"`.
- [`server/app/api/users.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/users.py):
  - Safely resolved `status` as a string from runtime presence or database enum.
- [`server/app/api/deps.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/deps.py) & [`server/app/sockets/manager.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/sockets/manager.py):
  - Supported both numeric user ID strings and email strings in JWT `sub` to eliminate `ValueError: invalid literal for int()`.
- [`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx):
  - Added try/catch isolation around backend user fetching so initialization continues gracefully.

### Patch vs. Root Cause Fix
- Initial schema union was a **hotfix** to unblock endpoints immediately, followed by the complete **architectural root cause decoupling** in Section 11 below.

---

## 11. Architectural Decoupling of Account Status & Presence

### What was the issue?
The codebase originally suffered from an architectural conflation between two fundamentally distinct concerns:
1. **Account Lifecycle Status** (Database-persisted, administrative): Whether an account is enabled or suspended (`active` / `disabled`).
2. **Ephemeral Presence Status** (In-memory, runtime): Real-time network availability (`online`, `busy`, `away`, `offline`).

Overloading the single field `status` caused cascading bugs:
- Setting `status = "online"` broke database enum validation.
- Inspecting `user.status !== 'disabled'` broke when a user was `offline` (since `'offline' !== 'disabled'` evaluated as true, but conflated presence with authorization).
- Admin endpoints, user schemas, and WebSocket broadcasts were prone to schema validation crashes.

### What changes were made?
1. **Backend Database Model ([`server/app/models/user.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/models/user.py))**:
   - Kept the database column `status` strictly mapped to `UserStatus` (`active` | `disabled`).
   - Added clean `@property` getters: `account_status` (returns `self.status`), `is_active` (`bool`), and default `presence = "offline"`.
2. **Pydantic Response Schemas ([`server/app/schemas/user.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/schemas/user.py))**:
   - Added explicit first-class fields: `account_status: UserStatus`, `is_active: bool`, and `presence: str = "offline"`.
   - Kept `status: Union[str, UserStatus] = "active"` for backwards compatibility with any legacy client callers.
3. **API & Realtime Payloads ([`server/app/api/users.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/users.py), [`server/app/api/admin.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/admin.py), [`server/app/api/auth.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/auth.py))**:
   - Ensured all responses and `user:created` Socket.IO events broadcast `account_status`, `is_active`, and `presence`.
4. **Frontend Types & Context ([`client/src/types.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/types.ts), [`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
   - Separated types into `UserPresence` (`'online' | 'away' | 'busy' | 'offline'`) and `UserAccountStatus` (`'active' | 'disabled'`).
   - In `mapBackendUser`, decoupled `isAccountActive` (`u.is_active` / `u.account_status`) from `presence`.
   - Preserved `user.status` and `user.isActive` on the React `User` model, ensuring zero breakage in existing UI components (`Avatar`, `Sidebar`, `RightSidebar`, `AdminPanel`).

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Permanently separates persistence/authorization semantics from real-time ephemeral presence across the entire system.

---

## 12. Strict RBAC Account Provisioning & Sign-Out Account Focus

### What was the issue?
1. **Public Account Creation Backdoors**: The system specification states: *"No public sign-up — all accounts provisioned by a single Main-Admin."* However, `LoginModal.tsx` and `HomePage.tsx` contained "Create New Account" tabs, `CommandPalette.tsx` had an "act-signup" command, and backend `server/app/api/auth.py` had a public `@router.post("/register")` endpoint allowing anyone to create accounts and self-assign roles or departments without admin authorization.
2. **Auto-Login & Account Focus Flaw on Sign-Out**: In `ChatContext.tsx`, `initAuth()` had an auto-login hook that automatically re-authenticated as `admin@company.internal` whenever `token` was cleared upon clicking "Sign Out". `LoginModal.tsx` hardcoded its initial state to `admin@company.internal`, causing the Main-Admin account to always retain the active focus border even when an employee like Danny logged out.

### What changes were made?
- **Backend API ([`server/app/api/auth.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/auth.py))**:
  - Disabled `@router.post("/register")` with an explicit `HTTP 403 Forbidden` response enforcing that account provisioning is strictly confined to Main-Admin within the workspace.
- **Frontend Services ([`client/src/services/api.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/api.ts))**:
  - Removed public `register` API client function.
- **State Management ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Removed auto-bootstrap login hook from `initAuth()`.
  - In `logout()`, stored the active user's ID into `localStorage.setItem('chat_last_active_user_id', currentUserId)` so the sign-in modal recognizes who just signed out.
  - Removed `register` from `ChatContextType` and context provider.
- **Login Modal ([`client/src/components/modals/LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx))**:
  - Completely removed "Create New Account" tab, signup state, password generator, and registration handlers.
  - Dynamically initialized `selectedUserId` and prefilled `email` from the last active user (e.g. Danny on sign-out).
  - Pinned the active/selected account to the top of the 1-click accounts list with an active blue border and indicator badge.
- **Home Page & Command Palette ([`client/src/components/home/HomePage.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/home/HomePage.tsx), [`client/src/components/modals/CommandPalette.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/CommandPalette.tsx))**:
  - Removed the registration form from `HomePage.tsx`.
  - Removed `act-signup` from `CommandPalette.tsx`.
- **Sidebar ([`client/src/components/sidebar/Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx))**:
  - Changed prompt button copy from "Add or Switch Account" to "Switch Account".

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Eliminates all rogue public registration surfaces and resolves the state discrepancy on session termination.

---

## 13. Real File Attachment Delivery & Rich Media Streaming / Lightbox

### What was the issue?
1. **Files Not Going to Other Users (Danny)**:
   - `MessageInput.tsx` created local `URL.createObjectURL(f)` ephemeral blob URLs.
   - When sending, `ChatContext.tsx` passed `attachment_ids: ['att-...']` directly to `POST /api/messages` instead of uploading the binary file to `POST /api/attachments/upload`.
   - As a result, the backend SQLite `attachments` table was completely empty (`count == 0`), files were never saved to disk, and other users (such as Danny) received no attachments. Furthermore, sending a file alone resulted in `HTTP 400: Message content cannot be empty`.
2. **Missing Previews for Media**:
   - `MessageItem.tsx` rendered only a generic `FileText` icon for every attachment regardless of type (PNG, JPG, MP4, WEBM, MP3, PDF). There was no inline image rendering, no HTML5 video player, and no full-screen lightbox inspection.
3. **Dummy Alerts on Model/Telemetry Cards**:
   - `MessageItem.tsx` contained mock `onClick={() => alert('Validation score: 87.4% on MMLU benchmarks')}` calls.

### What changes were made?
- **Backend ([`server/app/main.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/main.py), [`server/app/schemas/chat.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/schemas/chat.py), [`server/app/api/messages.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/messages.py))**:
  - Mounted `/uploads` directory in FastAPI via `StaticFiles`.
  - Added `url` and `download_url` fields to `AttachmentOut`.
  - Formatted attachment payloads to deliver direct `/api/attachments/{id}/view` and `/api/attachments/{id}/download` routes.
- **Frontend Context ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - In `sendMessage`: detects attachments with `rawFile` and uploads them via `api.uploadAttachment(formData)` to `POST /api/attachments/upload` with recipient and team attributes.
  - In `mapBackendMessage`: dynamically maps incoming socket/REST attachments to token-authenticated streaming URLs (`/api/attachments/{id}/view?token=...` and `/api/attachments/{id}/download?token=...`), ensuring other users (like Danny) can view images and stream videos directly.
- **Message Input ([`client/src/components/chat/MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx))**:
  - Preserves the `rawFile` reference in attachment state.
  - Added `onPaste` clipboard handler to intercept screenshot/clipboard image pastes.
  - Added rich thumbnail previews in the pending attachment tray with remove buttons.
- **Message Item ([`client/src/components/chat/MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx))**:
  - **Images**: High-quality responsive thumbnail with zoom & download overlay, click-to-enlarge full-screen Lightbox modal with download controls.
  - **Videos**: Built-in HTML5 `<video controls>` player supporting MP4, WEBM, MOV, and M4V.
  - **Audios**: Embedded `<audio controls>` player for audio files.
  - **Documents**: Polished card with file icon, truncated filename, formatted byte size, and authenticated download link.
  - Replaced browser `alert()` popups with non-intrusive in-app notifications (`addToast`).

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Replaces client-side blob mocks with full multipart `FormData` backend upload pipeline, authenticated streaming endpoints, and real-time Socket.IO broadcasts.

---

## 14. Core Workflow Root-Cause Fixes: Real-Time Lifecycle, Channel Segregation & Storage Concurrency

### What was the issue?
1. **Broken Real-Time Message Deletion**:
   - Backend `delete_message` emitted `{ "message_id": msg.id }`, but frontend `socket.on('message:deleted')` looked for `delPayload.id`. Because `delPayload.id` was `undefined`, soft-deleted messages never disappeared from other users' screens in real time.
2. **Missing Real-Time Message Edits**:
   - `PATCH /api/messages/{id}` updated SQLite, but never emitted any Socket.IO broadcast event. Workstations of colleagues never received edited text until page reload.
3. **Fuzzy Substring Match in DM Seen Receipts**:
   - `socket.on('message:read_confirm')` checked `m.conversationId.includes(String(payload.reader_id))`. If reader was user `2`, conversation `dm-1-20` and `dm-21-25` also matched because `"2"` was a substring, falsely marking unrelated chats as "Seen".
4. **Channel Format Segregation Leak on File Uploads**:
   - Special channels `#announcements` and `#updates` belong to the `coordination` department and rely on `format` (`channel:announcements`) to segregate messages. `upload_attachment` did not accept `format`, defaulting all uploads to `format: 'plain'` and `team: 'coordination'`, which caused admin files in `#announcements` to leak into `#coordination`.
5. **SQLite Locking & Unauthenticated Public Storage Mount**:
   - SQLite defaulted to blocking `DELETE` journal mode, locking the database during concurrent write spikes.
   - `main.py` mounted `/uploads` directly with `StaticFiles`, allowing anyone on the network to download private files without authentication.

### What changes were made?
- **Backend Concurrency & Security ([`server/app/core/database.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/core/database.py), [`server/app/main.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/main.py))**:
  - Attached SQLAlchemy event listener enabling SQLite **WAL Mode** (`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;`), allowing concurrent readers and writers without lockups.
  - Removed unauthenticated `app.mount("/uploads", ...)` mount, ensuring all file access strictly flows through authenticated, role-verified API routes (`/api/attachments/{id}/view` and `/download`).
- **Real-Time Lifecycle Contracts ([`server/app/sockets/manager.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/sockets/manager.py), [`server/app/api/messages.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/messages.py))**:
  - Added `broadcast_message_edited` and called it from `async def edit_message`.
  - Guaranteed invariant payload structure with both `id` and `message_id` in `broadcast_message_deleted`.
- **Channel Format Preservation ([`server/app/api/attachments.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/attachments.py))**:
  - Extended `POST /api/attachments/upload` to accept `format: Optional[str] = Form(None)` and assigned it to the created `Message`.
- **Frontend State Integrity ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - In `sendMessage`: forwarded `msgFormat` into `FormData` for attachment uploads.
  - In socket listeners:
    - Added `socket.on('message:edited')` to update message text, formatting, and `editedAt` across all open clients in real time.
    - Updated `socket.on('message:deleted')` to resolve `delPayload?.id || delPayload?.message_id`.
    - Updated `socket.on('message:read_confirm')` to strictly match the exact canonical DM ID (`dm-${Math.min(myId, readerId)}-${Math.max(myId, readerId)}`) and only update messages sent by the current user.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Replaces mismatched ad-hoc payloads with a symmetric event contract, enforces deterministic DM entity addressing, preserves channel destination metadata through file uploads, and enables database engine concurrency.

---

## Summary Matrix

| Change Area | Issue Addressed | Root Cause or Patch? | Better Alternative Available? |
| :--- | :--- | :--- | :--- |
| **Enter Key Duplication** | Duplicate messages rendered on Enter | Hybrid (Event throttle is patch; signature dedup is root cause) | Client-generated UUID idempotency key |
| **Quote Invisibility** | Faint ghost text on white theme | **Root Cause Fix** | Full AST-based markdown parser |
| **Workspace Members** | Added users hidden in channel sidebar | **Root Cause Fix** | Global Command Palette (`Cmd+K`) |
| **Admin User Creation** | Missing real-time update & swallowed errors | **Root Cause Fix** | Async email-check on blur |
| **Theme Toning** | Eye-straining glare and tacky sizing | **Root Cause Fix** | HSL contrast tokens |
| **3-in-1 Sidebar** | Fragmented drawers & wasted space | **Root Cause Fix** | Collapsible accordion sections |
| **Delete Message Guard** | Accidental deletions & editable deleted msgs | Hybrid (Native confirm is patch; edit disable is root cause) | In-app modal + 5-second Undo toast |
| **Date Dividers** | Static dates instead of actual chat date | **Root Cause Fix** | Standard date-fns localization |
| **Duplicate Global Search** | Two conflicting search modals on Ctrl+K | **Root Cause Fix** | Single unified Command Palette |
| **Account Status vs Presence** | Presence status crashed Pydantic validation & conflated suspension | **Root Cause Fix** | Clean domain separation of `account_status` & `presence` |
| **Strict RBAC & Sign-Out Focus** | Public signup backdoor & admin auto-login on logout | **Root Cause Fix** | Enforce Main-Admin only provisioning and persist last active session identity |
| **Real File Delivery & Media Previews** | Files not reaching recipient, blob URL mock, missing image/video previews | **Root Cause Fix** | Multipart upload pipeline, streaming endpoints with token auth, inline video player & lightbox |
| **Core Lifecycle & Concurrency Fixes** | Broken real-time deletion, missing edit broadcast, DM seen bleed, WAL mode | **Root Cause Fix** | Symmetric lifecycle event contracts, canonical DM targeting, attachment format routing & SQLite WAL |
| **Core Lifecycle & Concurrency Fixes** | Broken real-time deletion, missing edit broadcast, DM seen bleed, WAL mode | **Root Cause Fix** | Symmetric lifecycle event contracts, canonical DM targeting, attachment format routing & SQLite WAL |
| **Native Windows Desktop Notifications** | Notifications blocked/missed when app minimized or backgrounded; broken icon | **Root Cause Fix** | Windows Toast API integration, blur/unfocused tab detection, WhatsApp-style header toggle & banner |
| **Fast Reply, Preferences & Windows Auto-Start** | No quick reply mechanism; no notification scope/privacy customization; missing startup launch & hardcoded host | **Root Cause Fix** | Fast Reply popup with preset chips, Notification Preferences modal, PWA manifest, Windows Startup launcher & VPS Link |
| **Minimized Windows Toast & SW Push** | No popups when webapp minimized/hidden despite browser permissions | **Root Cause Fix** | Service Worker system push (`sw.js`), `renotify: true`, dynamic preference ref & scope default to 'all' |

---

## 15. Native Windows Desktop Notifications (WhatsApp Desktop / Slack Style)

### What was the issue?
1. **Passive Browser Permission Suppression**:
   - Modern Chromium browsers (Edge, Chrome) reject silent or indiscriminate `Notification.requestPermission()` calls that do not originate from an explicit user gesture, silently leaving notifications disabled without alerting the user.
2. **Foreground Tab Suppression Trap**:
   - The application previously checked `if (incoming.conversationId !== currConv)` before dispatching notifications. When an employee had an open conversation with a colleague and minimized the browser to work in VS Code, Excel, or Word, `currConv` still matched. As a result, the user never received any notification that their colleague sent them a message while their window was in the background.
3. **Missing Click-to-Focus Action**:
   - In-app desktop notifications had no `onclick` navigation logic. Clicking the Windows notification did not bring the browser window to the front or switch to the sender's conversation.
4. **404 Broken Notification Icon**:
   - Notifications referenced `/favicon.ico` which was missing from the `public/` directory, preventing Windows from rendering a branded toast icon.

### What changes were made?
- **Dedicated Desktop Notification Service ([`client/src/services/desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts))**:
  - Implemented `getDesktopNotificationPermission()`, `requestDesktopNotificationPermission()`, `sendTestDesktopNotification()`, and `showIncomingMessageNotification()`.
  - Configured native Windows notification options with high-resolution app branding (`/logo.jpeg`), conversation tag grouping, message truncation, and attachment indicators.
  - Attached `notif.onclick = () => { window.focus(); onClick(); notif.close(); }` to immediately bring the browser window forward and focus the relevant chat on click.
- **Smart Window Focus & Background Detection ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Integrated `isWindowHidden = typeof document !== 'undefined' && (document.hidden || !document.hasFocus())`.
  - Dispatches native Windows bottom-right notification popups if the user is in a different chat **OR** if the browser window is currently minimized, hidden, or not focused.
  - Exposes `desktopNotificationPermission`, `requestDesktopNotificationPermission`, and `sendTestDesktopNotification` across the entire chat context.
- **WhatsApp-Style User Controls & Header Quick-Toggle ([`client/src/components/chat/ChatArea.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/ChatArea.tsx))**:
  - Added a notification status bell icon in the Chat Area header:
    - **Green dot (`granted`)**: Clicking immediately fires a test Windows notification popup so the user can verify the toast in the bottom-right corner.
    - **Amber pulse (`default`)**: Alerts the user that notifications can be enabled with one click.
    - **Bell-off (`denied`)**: Notifies the user if desktop popups were blocked in browser site permissions.
  - Added a non-intrusive WhatsApp-style prompt banner above the chat stream: *"Get notified of new personal messages with Windows desktop popups"* with **[Turn on desktop notifications]** and **[✕]** dismiss actions.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Solves the permission lifecycle with proper user gestures, eliminates the hidden window suppression flaw, adds click-to-focus navigation, and directly hooks into the native Windows Notification system.

---

## 16. Fast Reply Popup, Notification Preferences, Windows Auto-Start & Configurable VPS Link

### What was the issue?
1. **Missing Quick Reply Workflow**:
   - Responding to an urgent direct message required the employee to abandon their current screen, find the conversation in the sidebar, open it, and type into the main input.
2. **Lack of Notification Customization**:
   - No way to filter notifications (e.g. DMs only vs noisy channels) or protect screen privacy when colleagues walk past the desk.
3. **Absence of Laptop Startup Launch & Missed Messages Summary**:
   - The web app did not launch on laptop boot, nor did it summarize missed messages that arrived while the user was away.
4. **Hardcoded Localhost Hostname**:
   - Frontend API endpoints and WebSocket links had no centralized configuration variable in the UI for pointing the app to a remote VPS server.

### What changes were made?
- **WhatsApp-Style Fast Reply Floating Widget ([`client/src/components/chat/QuickReplyPopup.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/QuickReplyPopup.tsx))**:
  - Floating bottom-right card with sender avatar, message snippet, and one-click preset response chips (`👍 Okay`, `⏳ I am busy, will reply soon`, `🤝 Working on it`, `✅ Received, thanks`, `📞 Call me when free`).
  - Integrated fast inline text composer with Enter-to-send support.
  - Added `Quick Reply` action buttons directly on in-app toast notifications.
- **Granular Notification Preferences Modal ([`client/src/components/chat/NotificationSettingsModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/NotificationSettingsModal.tsx))**:
  - **Scope**: Toggle between `DMs & Mentions Only (Recommended)`, `Direct Messages Only`, and `All Messages`.
  - **Desk Privacy Mode**: Masks message text in Windows toasts with *"New message received"*.
  - **Sound Chimes**: Toggle audio alert on/off.
  - **Startup Catch-Up**: Toggle automatic missed messages summary on boot.
- **Missed Messages Catch-Up Notification on Boot ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - On launch/boot, checks unread messages and automatically dispatches a consolidated Windows toast summarizing all missed messages with one-click navigation.
- **PWA Manifest & Windows Auto-Start Script ([`client/public/manifest.json`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/manifest.json), [`setup_windows_startup.ps1`](file:///c:/Users/Pc/Documents/Personalize-Chat/setup_windows_startup.ps1))**:
  - Added PWA manifest enabling standalone chromeless desktop app installation in Edge & Chrome.
  - Added 1-click PowerShell automation script (`setup_windows_startup.ps1`) to register Personalize Chat in Windows Startup (`shell:startup`).
- **Configurable Server Link / VPS Variable ([`client/src/components/admin/AdminConsoleModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/admin/AdminConsoleModal.tsx), [`client/src/services/api.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/api.ts), [`client/src/services/socket.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/socket.ts))**:
  - Added **"Server Link / Remote VPS Address"** input in the Admin Settings panel.
  - Defaults to local server (`http://127.0.0.1:8000`). When Main Admin inputs a VPS address, both REST API and Socket.IO dynamically route traffic to the VPS.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Implements a non-disruptive floating response pipeline, native PWA desktop integration, persistent customizable notification preferences, and dynamic network addressing for VPS deployment.

---

## 9. Modal Backdrop Click-to-Close & Mobile Navigation / Tab Close UX

### What was the issue?
1. **Trapped on Blank / Backdrop Area Click**:
   - Modals throughout the application (Admin Console, Login / Switch Account, New DM, New Channel, User Profile, Notification Settings, Search) did not dismiss when users clicked or tapped on the blank/backdrop area outside the card.
2. **Missing `X` Close Button on Login/Signup for Unauthenticated Users**:
   - In [`LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx), the header close `X` button was conditionally wrapped with `{isAuthenticated && (...) }`. When an unauthenticated mobile user opened the app, no close button existed, trapping them completely.
3. **Getting Stuck on Mobile Tabs and Drawers**:
   - In [`AdminConsoleModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/admin/AdminConsoleModal.tsx), the tab navigation lacked responsive horizontal scrolling and an immediate close trigger on mobile viewports.
   - In [`CommandPalette.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/CommandPalette.tsx) and [`SearchModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/SearchModal.tsx), keyboard-less mobile devices had only an `ESC` keyboard badge and no accessible close action when exploring filter tabs.
   - In [`Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx), selecting a channel or DM did not auto-close the mobile drawer, leaving users on mobile staring at the sidebar instead of their chosen chat.
   - In [`RightSidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/RightSidebar.tsx) and [`ThreadDrawer.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/ThreadDrawer.tsx), opening them on mobile horizontally compressed the screen without a backdrop.

### What changes were made?
- **Universal Backdrop Dismissal**:
  - Implemented `onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}` on all modal backdrops ([`LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx), [`AdminConsoleModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/admin/AdminConsoleModal.tsx), [`NewDmModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/NewDmModal.tsx), [`NewChannelModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/NewChannelModal.tsx), [`UserProfileModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/UserProfileModal.tsx), [`SearchModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/SearchModal.tsx), [`NotificationSettingsModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/NotificationSettingsModal.tsx), [`MeshNodeInfoModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/MeshNodeInfoModal.tsx), [`UnauthorizedModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/UnauthorizedModal.tsx)).
  - Added `onClick={(e) => e.stopPropagation()}` on dialog bodies to preserve inner form clicks.
- **Login / Account Switcher UX Overhaul ([`LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx))**:
  - Removed `{isAuthenticated && ...}` restriction so the prominent `X` button is ALWAYS visible with a minimum 40x40px touch hit area.
  - Added dedicated tabs (`Sign In` vs `Switch Account`) with an inline mobile-friendly `Close` button right on the tab strip.
  - Added a bottom dismiss button (`Close`) for users who scroll to the bottom.
- **Admin Console Mobile Tab Strip ([`AdminConsoleModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/admin/AdminConsoleModal.tsx))**:
  - Added horizontal smooth scrolling `overflow-x-auto scrollbar-none` so tabs never squish or overflow on mobile.
  - Added a dedicated mobile close button (`<X /> Close`) directly on the tab strip.
  - Upgraded header close button to 40x40px hit area.
- **Mobile Drawer Auto-Close on Navigation ([`Sidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/sidebar/Sidebar.tsx))**:
  - Automatically dismisses the mobile sidebar drawer (`setSidebarMobileOpen(false)`) whenever a user selects any announcement channel, update channel, department team channel, or colleague direct message.
  - Enlarged the mobile sidebar header close button.
- **Mobile Overlays for Right Panels ([`RightSidebar.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/RightSidebar.tsx), [`ThreadDrawer.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/ThreadDrawer.tsx))**:
  - Added backdrop overlay with tap-to-close behavior on mobile.
  - Positioned fixed on mobile (`fixed lg:static inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-[350px]`) so opening details or thread replies never distorts the mobile chat layout.
- **Search & Command Palette Mobile Close Buttons ([`CommandPalette.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/CommandPalette.tsx), [`SearchModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/SearchModal.tsx))**:
  - Replaced keyboard-only `ESC` dependencies with always-visible close buttons and inline tab-row mobile close options.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Resolves mobile touch targets, viewport boundary constraints, and backdrop event propagation architectures universally across the client application.

---

## 10. Android Reload Blank Screen & React Hook Ordering

### What was the issue?
On Android mobile browsers (and any fresh browser reload without an active JWT session), the application briefly flashed the chat UI for a fraction of a second ("glimpse") and then crashed completely to a blank white screen.

### Root Cause Analysis
In [`LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx), a state hook was placed **after** an early return:
```tsx
if (!loginModalOpen) return null; // Line 64
// ...
const [authTab, setAuthTab] = useState<'credentials' | 'accounts'>('credentials'); // Line 87
```
1. **First Render**: `loginModalOpen` was `false`. React evaluated 8 hooks and exited with `return null`. The chat screen rendered for a split second.
2. **Immediate Auth Check**: `initAuth()` in `ChatContext` checked the token, saw no valid session, and set `setLoginModalOpen(true)`.
3. **Second Render**: `loginModalOpen` was `true`. React bypassed `return null` and evaluated the 9th hook (`useState(authTab)`).
4. **React Fatal Exception**: React threw: `Error: Rendered more hooks than during the previous render. All React hooks must be called in the exact same order.`
5. In React 18, uncaught render errors unmount the entire DOM root, producing a permanent white screen.

### What changes were made?
- **Hook Ordering**: Moved `const [authTab, setAuthTab] = useState(...)` to the top of `LoginModal.tsx` alongside all other hook calls, ensuring identical hook execution count on every render pass.
- **Error Boundary**: Created [`ErrorBoundary.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/common/ErrorBoundary.tsx) and wrapped the root `<App />` component in [`App.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/App.tsx). Any unexpected runtime errors now present an interactive recovery screen ("Reload Page" or "Reset & Sign In") instead of an unrecoverable blank white screen.

---

## 11. Dynamic Media Sizing & Removal of Static Grey Blocks

### What was the issue?
Uploaded images and videos displayed large empty grey blocks to the right. When images were narrow or square (e.g. 200x200 retro PC icons or mobile portrait screenshots), the media only filled part of the box, leaving the rest of the container exposed as a static grey block.

### Root Cause Analysis
1. In [`MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx), the parent flex column lacked `items-start`, causing children to stretch to 100% width (`align-self: stretch`).
2. The attachment wrapper had fixed constraints (`max-w-sm sm:max-w-md`) and a static background `bg-black/20`. In the Nordic (light) theme, `bg-black/20` rendered as an opaque grey fill.
3. The image tag had `max-h-[300px] w-auto`, sizing only to its intrinsic aspect ratio, exposing the container's grey background on the right.
4. The hover overlay had `absolute inset-0`, spreading the dark gradient over both the image and the empty grey area.

### What changes were made?
- **Dynamic Hugging**: Updated the wrapper to `w-fit max-w-full` with `items-start` on the parent flex column. The container now hugs the exact natural aspect ratio of the image or video with zero empty space.
- **Theme-Aware Borders & Transparent Fill**: Replaced `bg-black/20` with clean borders (`border-slate-200 bg-slate-100/50` in light mode, `border-slate-700/60 bg-slate-900/30` in dark mode).
- **Block Display**: Added `block` to `<img>` to eliminate inline baseline whitespace.
- **Fitted Bottom Action Bar**: Changed the overlay to `absolute inset-x-0 bottom-0` so the filename, file size, download, and fullscreen buttons span only the bottom of the image itself. Added `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` for mobile touch accessibility.
- **Fitted Video Player**: Updated video containers to `w-fit max-w-full sm:max-w-lg` with `block max-h-[360px] w-auto object-contain`, ensuring both vertical phone clips and widescreen videos hug tightly.

---

## 12. Powerful Global Workspace Search (Files & Messages)

### What was the issue?
Global Search (Ctrl+K / "Search workspace...") only checked local channels, colleagues, and rudimentary text matching. It lacked dedicated file searching, media discovery, historical backend message queries, and keyword highlighting.

### What changes were made?
- **Backend Search Endpoint (`GET /api/messages/search`)**:
  - Implemented in [`server/app/api/messages.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/messages.py) with full Role-Based Access Control (RBAC).
  - Searches messages (`Message.content.ilike`) and files (`Attachment.file_name.ilike`).
  - Strict security: users only see public announcements/updates, their authorized department teams, and direct messages they participated in.
- **Frontend Search Engine ([`CommandPalette.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/CommandPalette.tsx), [`SearchModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/SearchModal.tsx))**:
  - **Files & Media Search**: Search by filename, extension, or type (`image`, `video`, `pdf`, `mp4`, `png`). Includes distinct format icons, direct **Download** button, and "Jump to Message".
  - **Message Search with Keyword Highlighting**: Matched terms are wrapped in `<mark>` tags. Displays sender name, channel/DM pill, date, and `📎 File` attachment indicator.
  - **Live Category Badges**: Filter chips display dynamic count badges (`All`, `Messages`, `Files & Media`, `Channels`, `Colleagues`, `Actions`).
  - **Interactive Jump**: Selecting a message or file immediately switches to the conversation, scrolls to the message, and flashes a highlight glow (`setHighlightedMessageId`).
- **Unit Testing**: Added `test_global_search_messages_and_files` in [`server/tests/test_api.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/tests/test_api.py) (11/11 tests passing).

---

## 13. Authentication Gate & Unauthenticated Shell Exposure Prevention

### What was the issue?
1. **Unauthenticated Shell Exposure**: When visiting the app without a token, users could dismiss/close the login modal and see the full chat workspace in the background. The bottom-left profile falsely displayed "Main Admin", while chats showed 0 messages and 0 members because the user had no token.
2. **Hanging at "Authenticating..."**: When clicking Sign In, the button became permanently stuck at `Authenticating...` without completing or displaying an error.

### Root Cause Analysis
1. **Shell Exposure**: In `App.tsx`, `ChatApp` rendered `<Sidebar />` and `<ChatArea />` regardless of `isAuthenticated`. In `ChatContext.tsx`, `currentUser` defaulted to `INITIAL_USERS[0]` (Main Admin) when unauthenticated. In `LoginModal.tsx`, the `X` button and backdrop click were always enabled, letting users bypass login to inspect an empty chat shell.
2. **Stuck Authentication**: The background Uvicorn dev process (spawned with `--reload`) had deadlocked on its child worker process, causing incoming HTTP `POST /api/auth/login` requests to hang without receiving a response. Furthermore, `fetch()` in `api.ts` lacked a timeout, meaning requests waited indefinitely.

### What changes were made?
- **Strict Authentication Gate in [`App.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/App.tsx)**:
  - If `!isAuthenticated`, `ChatApp` returns ONLY the secure Authentication screen. The chat workspace shell (`Sidebar`, `ChatArea`, `RightSidebar`) is **never mounted or exposed** to unauthenticated visitors.
- **Non-Dismissible Login ([`LoginModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/modals/LoginModal.tsx))**:
  - When `!isAuthenticated` or `isStandalone`, the `X` button and backdrop click-to-close are completely disabled. Users cannot bypass login without valid credentials.
  - Only after authenticating does the modal close and unlock the chat workspace with their verified account. When already logged in, "Switch Account" still permits closing to cancel.
- **Request Timeout & Error Protection in [`api.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/api.ts)**:
  - Added a 10-second `AbortController` timeout to `request()`. If the backend or network is unresponsive, it automatically aborts and displays a clear error (*"Server connection timed out (10s). Please verify the backend is running."*) instead of hanging indefinitely.
---

## 14. Background & Minimized Desktop Notifications Delivery (Service Worker & Windows Toast Fix)

### What was the issue?
When the web application was minimized, incoming messages from colleagues did not trigger the bottom-right Windows notification toast or Chrome system notification, even when browser notification permissions were granted.

### Root Cause Analysis
1. **Default Scope Filtering (`dms_and_mentions`)**:
   - In [`ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx), `notificationPreferences.scope` defaulted to `'dms_and_mentions'`. When a colleague sent a message in a department channel (e.g. `#team_ai`, `#hr_admin`, `#coordination`), the application checked whether the user was directly tagged (`@handle` or explicit name). If not tagged, `scopeAllowed` evaluated to `false` and discarded the desktop notification completely.
2. **Stale Closure in Socket Event Listener**:
   - In [`ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx), `socket.on('message:receive')` was attached inside a `useEffect` that captured `notificationPreferences` from state. Because the effect dependencies did not include `notificationPreferences`, any change made in the Notification Settings modal was ignored by the active socket listener.
3. **Windows Toast Collapsing & Missing `renotify: true`**:
   - In [`desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts), notifications were created with a static `tag: opts.conversationId`. In Windows 10 and 11, if an existing notification exists in the Windows Action Center with the same tag, Windows **silently replaces** the text in the Action Center tray without popping up a new toast banner unless `renotify: true` is explicitly passed and a unique tag is used.
4. **Chrome Background Tab Throttling & Lack of Service Worker**:
   - When Chrome is minimized or runs in the background, Chromium throttles background page scripts and drops `new Notification(...)` calls from tab DOM contexts to save resources. Modern Chrome requires notifications to be delegated through a registered **Service Worker** (`registration.showNotification(...)`), which routes directly through the Windows Notification Platform (WNP) as a background system push.

### What changes were made?
- **Background Notification Service Worker ([`client/public/sw.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/sw.js))**:
  - Created a dedicated Service Worker that handles `install`, `activate`, `SHOW_NOTIFICATION`, and `notificationclick` events.
  - On notification click, the service worker focuses the existing app window and sends a `NAVIGATE_CONVERSATION` message so the app immediately opens the relevant chat.
- **Service Worker Delegation & Unique Tags ([`client/src/services/desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts))**:
  - Automatically registers `sw.js` via `initDesktopNotificationService()`.
  - Upgraded `showIncomingMessageNotification()` to prioritize `reg.showNotification()`.
  - Added unique message timestamps to tags (`${opts.conversationId}-${Date.now()}`) and enabled `renotify: true`, ensuring every new message pops up a fresh Windows toast banner.
  - Added fallback to `new Notification()` if service workers are unavailable.
- **Dynamic Preference Ref & Workspace Default Scope ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Added `notificationPreferencesRef` to eliminate stale closures; the incoming socket listener now always reads the current preferences in real-time.
  - Updated default scope from `'dms_and_mentions'` to `'all'` so all workspace channels and DMs trigger desktop alerts when minimized.
  - Added a Service Worker message listener to switch active conversations when a notification toast is clicked.
- **Interactive Minimized Test & Troubleshooting Guide ([`client/src/components/chat/NotificationSettingsModal.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/NotificationSettingsModal.tsx))**:
  - Added a **"Test Minimized Popup (Fires in 4s)"** button with a live countdown timer (`Minimize now! Fires in 4s...`), allowing users to minimize their browser and verify that the Windows toast appears.
  - Added a **Windows Notification Troubleshooting Guide** covering Windows Focus Assist / Do Not Disturb and Windows Settings banner permissions.

### Patch vs. Root Cause Fix
---

## 15. Windows Notification Inline Reply Box & Quick Actions

### What was the issue?
Users had to bring the browser window to focus and manually find the conversation to respond to an incoming message from a colleague. There was no inline text reply box inside the Windows toast notification banner.

### What changes were made?
- **Notification Actions with Text Input (`type: 'text'`)**:
  - In [`client/src/services/desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts), added interactive notification action buttons to both live and test notifications:
    - **Inline Reply Input (`{ action: 'reply', type: 'text', title: 'Reply', placeholder: 'Type a message...' }`)**: Supported by Chromium and Windows Notification Platform; displays a text entry box and Send button directly inside the Windows toast popup.
    - **Mark as Read (`{ action: 'mark_read', title: 'Mark as read' }`)**: Clears unread counts and confirms receipt without typing.
- **Service Worker Direct Background Fallback ([`client/public/sw.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/sw.js))**:
  - In `notificationclick`, inspects `event.action` and `event.reply`.
  - Dispatches `{ type: 'INLINE_REPLY', conversationId, content: event.reply }` to client windows.
  - **Direct Background API Fallback**: If the tab is sleeping or throttled, the Service Worker directly fires `fetch('/api/messages')` with the user's JWT token and target `recipient_id` / `team`, guaranteeing delivery without relying on foreground DOM execution.
  - Shows an immediate toast notification: `Personalize Chat • Reply Sent: "..."` confirming receipt.
- **Immediate Worker Lifecycle Update & Dynamic Targeting ([`client/src/services/desktopNotification.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/services/desktopNotification.ts), [`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Added `await reg.update()` upon initialization, forcing Chrome to immediately replace and activate the newest Service Worker code rather than running cached scripts.
  - Passed the active conversation ID, recipient ID, and team name dynamically in test popups and incoming messages, ensuring replies are routed to valid, authorized conversations.
  - Attached dual listeners (`addEventListener('message')` and `navigator.serviceWorker.onmessage`) in `ChatContext.tsx` to process replies reliably.

### Patch vs. Root Cause Fix
---

## 16. Default Signature Obsidian Dark App Theme & Native Window Frame Color Sync

### What was the issue?
1. The application defaulted to the `nordic` light grey theme (`#D8DFE7`), causing the app to look like a generic light grey Chrome browser window instead of the bespoke executive dark obsidian interface.
2. In CSS, `:root` was mapped to the light `nordic` theme variables, causing initial renders to flash light grey before React state evaluated.
3. The installed PWA window frame and title bar were using static or mismatching theme colors rather than dynamically updating to match the active app surface color.

### What changes were made?
- **Root Signature Obsidian Dark Theme ([`client/src/index.css`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/index.css))**:
  - Re-mapped `:root` to the signature Executive Dark Slate theme (`--surface-base: #121620`, `--surface-card: #182030`, `--border-subtle: #222C3E`), ensuring zero initial flash of light grey.
- **Default State Migration ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Set initial theme state to `'slate'`.
  - Migrated any default `'nordic'` setting to `'slate'` so returning users immediately experience the rich dark theme.
- **Dynamic Meta Theme-Color Window Frame Sync ([`client/src/App.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/App.tsx))**:
  - Added dynamic `<meta name="theme-color">` synchronization that sets the browser title bar, mobile status bar, and installed PWA window header to `#121620` in dark mode and `#D8DFE7` in light mode.
- **PWA Manifest Synchronization ([`client/public/manifest.json`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/manifest.json))**:
  - Updated `"theme_color": "#121620"` and `"background_color": "#121620"` to match the dark app base.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Corrects the `:root` CSS token inheritance, establishes the dark palette as the canonical application identity, and synchronizes native window frame colors dynamically.

---

## 17. Chrome Desktop Notification Reply Idempotency & Duplicate Send Fix

### What was the issue?
When a user clicked "Reply" on a Chrome or Windows desktop notification and submitted text, the message was sent **2 to 3 times** to the recipient.
Investigation revealed compounding root causes:
1. In `ChatContext.tsx`, both `navigator.serviceWorker.addEventListener('message', handleSwMessage)` and `(navigator.serviceWorker as any).onmessage = handleSwMessage` were registered, causing Chromium to dispatch the event twice in a single tab.
2. In `sw.js`, `clients.matchAll()` broadcasted `INLINE_REPLY` to every open window/tab rather than targeting a single active window.
3. `sendQuickReply` lacked any in-flight throttle or deduplication cooldown.
4. Backend `POST /messages` had no idempotency guard against rapid duplicate submissions.

### What changes were made?
- **Service Worker ([`client/public/sw.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/sw.js))**:
  - Targeted only a single client window (`clientList.find(c => c.focused) || clientList[0]`) and attached a unique `replyId`.
  - Fallback direct `fetch()` now only executes if `clientList.length === 0`.
- **Frontend State Management ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Removed duplicate `(navigator.serviceWorker as any).onmessage` listener.
  - Added `processedRepliesRef` deduplication by `replyId`.
  - Added a 2.5-second in-flight cooldown and deduplication map in `sendQuickReply`.
- **Backend API Safeguard ([`server/app/api/messages.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/app/api/messages.py))**:
  - In `send_message`: queries for any identical message with matching sender, recipient/team, content, and format within the last 2.5 seconds. If found, returns the existing message rather than creating a duplicate row.
- **Automated Backend Tests ([`server/tests/test_api.py`](file:///c:/Users/Pc/Documents/Personalize-Chat/server/tests/test_api.py))**:
  - Added `test_message_idempotency_deduplication()` verifying rapid submissions resolve to identical message IDs.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Eliminates duplicate event listener binding, targets a single client in the service worker, enforces client-side deduplication, and secures the backend API with an idempotency window.

---

## 18. Suppression of Unwanted "Reply Sent" Notifications & Toast Spam

### What was the issue?
After replying to a notification, a new desktop notification banner (`"Personalize Chat • Reply Sent"`) popped up along with redundant in-app toasts, resulting in up to 3 popups for a single action.

### What changes were made?
- **Service Worker ([`client/public/sw.js`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/public/sw.js))**:
  - Completely removed `self.registration.showNotification('Personalize Chat • Reply Sent', ...)`.
- **Chat Context ([`client/src/context/ChatContext.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/context/ChatContext.tsx))**:
  - Added a `silent` boolean flag to `sendQuickReply(targetConvId, content, silent)`. Background inline replies pass `silent = true` to deliver replies cleanly without disruptive toast spam.

### Patch vs. Root Cause Fix
- **Root Cause Fix**. Deletes the extraneous notification trigger and silences background toasts.

---

## 19. Rich Text Formatting Engine, Automatic Word Detection & Smart List Continuation

### What was the issue?
Formatting required manual mouse-highlighting of words, lacked strikethrough, code, and list buttons, lacked list auto-continuation on Enter, and did not function in inline message edit mode (`MessageItem.tsx`). In edit mode, clicking format inserted the literal word `"text"` and rendered in unstyled light-mode cards that broke dark theme styling.

### What changes were made?
- **Centralized Formatting Utility ([`client/src/utils/textFormatting.ts`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/utils/textFormatting.ts))**:
  - Implemented `applySmartFormatting(textarea, text, setText, formatType)`:
    - **Automatic Word Detection (Zero-Selection)**: When cursor is inside a word, automatically scans outward across word boundaries and wraps it.
    - **Toggle-Off Support**: If the target word or selection is already formatted with markers, clicking the button or pressing the shortcut strips the markers.
    - **Centered Cursor on Empty Space**: When cursor is on whitespace, inserts marker pair and places cursor in the center (`**|**`).
    - Supports Bold (`**`), Italic (`*`), Strikethrough (`~~`), Inline Code (`` ` ``), Bullet Lists (`- `), Numbered Lists (`1. `), Blockquotes (`> `), and Links.
  - Implemented `handleSmartEnter(e, textarea, text, setText)`:
    - Automatically continues bullet items (`- `), numbered lists (`2. `), and blockquotes (`> `) when pressing `Enter`.
    - Pressing `Enter` on an empty list line cleanly deletes the marker and exits list mode.
  - Implemented `handleFormattingShortcuts(e, textarea, text, setText)`:
    - Handles `Ctrl/Cmd + B` (Bold), `Ctrl/Cmd + I` (Italic), `Ctrl/Cmd + Shift + X` (Strikethrough), and `Ctrl/Cmd + E` (Code).
- **Composer Integration ([`client/src/components/chat/MessageInput.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageInput.tsx))**:
  - Integrated `applySmartFormatting`, `handleSmartEnter`, and `handleFormattingShortcuts`.
  - Added Strikethrough button to the formatting toolbar.
- **Full Edit Mode Integration ([`client/src/components/chat/MessageItem.tsx`](file:///c:/Users/Pc/Documents/Personalize-Chat/client/src/components/chat/MessageItem.tsx))**:
  - Added full toolbar: Bold, Italic, Strikethrough, Code, Link, Bullet List, Numbered List, and Quote.
  - Enabled automatic word detection and keyboard shortcuts during message editing.
  - Added `Ctrl+Enter` to save and `Escape` to cancel.
  - Styled with series-C obsidian card design tokens (`bg-[#182030]` in dark mode, `bg-[#E8EEF5]` in light mode).

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Replaces brittle ad-hoc string replacements with a robust, shared parsing and boundary-detection engine utilized across both composer and edit modes.

---

## 20. Production-Grade Windows Batch Launcher Scripts (`.bat`)

### What was the issue?
1. [`start-server.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-server.bat) started Uvicorn watching the whole directory without `--reload-dir app` and without `--timeout-graceful-shutdown 1`. If an existing orphaned process held port 8000, startup crashed with `WinError 10048 (address already in use)`.
2. [`start-client.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-client.bat) hardcoded a specific winget Node path rather than dynamically detecting Node from the system environment.
3. [`start-all.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-all.bat) launched both simultaneously without ensuring the server port was clear.

### What changes were made?
- **Server Launcher ([`start-server.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-server.bat))**:
  - Automatically queries `netstat` for port 8000 and terminates any stale zombie process before launching.
  - Launches Uvicorn with `--reload-dir app` and `--timeout-graceful-shutdown 1`, preventing WebSocket reload hangs.
  - Includes a fallback to `python run_dev.py` if the CLI invocation encounters an error.
- **Client Launcher ([`start-client.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-client.bat))**:
  - Uses `where npm` for dynamic PATH detection with fallback to the local Winget package path only if needed.
- **Unified Launcher ([`start-all.bat`](file:///c:/Users/Pc/Documents/Personalize-Chat/start-all.bat))**:
  - Starts backend, allows it to initialize, starts the frontend, and launches the browser to `http://localhost:5173`.

### Patch vs. Root Cause Fix
- **Complete Root Cause Fix**. Eliminates port collision locks, provides clean socket shutdowns, and ensures self-healing launches across Windows environments.












