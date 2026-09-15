---
name: Midnight Slate Minimalist
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#6c6d6d'
  on-tertiary-container: '#f0f0f0'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 320px
  header-height: 56px
  composer-min-height: 52px
  thread-sidebar-width: 380px
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system targets high-velocity enterprise teams, security operations, and engineering organizations requiring an uncluttered, distraction-free communication environment. The aesthetic balances authoritative technical precision with frictionless workplace utility. It deliberately avoids consumer-grade playfulness, novelty gradients, and exaggerated pill bubbles, projecting instead the focused discipline of a mission-critical developer terminal fused with modern Scandinavian workplace ergonomics.

The design movement is **Corporate Modern Minimalist**:
- **Information Density:** Prioritizes vertical rhythm and scannability over decorative negative space.
- **Structural Integrity:** Crisp 1px borders, subtle tonal background differences, and strict grid alignments replace drop-shadow reliance.
- **Dignified Utility:** UI surfaces act as quiet, neutral frames designed to step back and make human communication immediately legible.

## Colors

The color palette is built around deep technical midnight slates paired with focused cobalt accents, pristine white tertiary highlights, and unambiguous semantic indicators. 

### Color Roles

- **Primary Accent (`#2563EB`)**: High-efficiency steel cobalt. Used exclusively for primary buttons, active channel indicators, link states, active unread counter badges, and focused interaction rings. Hover state deepens to `#1D4ED8`.
- **Secondary / Deep Midnight Base (`#0F172A`)**: Midnight slate anchor. Serves as primary typography color in light mode and secondary surface background in dark mode.
- **Tertiary Accent (`#FFFFFF`)**: Pure white used for high-contrast element emphasis, selected states, and critical focal points.
- **Neutral Core (`#94A3B8`)**: Mid-tone cool slate for secondary labels, muted timestamps, inline metadata, and border boundaries.

### Canvas Modes

- **Dark Mode (Default Experience)**:
  - Base canvas background: `#090D16` (Deep charcoal ink)
  - Sidebar container: `#0B111E`
  - Message thread background: `#0D1322`
  - Elevated surfaces / composer dock: `#131B2E`
  - Subtle micro-borders: `#1E293B`
  - Primary text: `#F1F5F9`
  - Secondary / muted text: `#94A3B8`

- **Light Mode**:
  - Base canvas background: `#F8F9FA` (Warm technical neutral, avoiding blinding sterile white)
  - Main panel surface: `#FFFFFF`
  - Sidebar container: `#0F172A` (Distinct dark sidebar persists in light mode for contextual grounding)
  - Subtle micro-borders: `#E2E8F0`
  - Primary text: `#0F172A`
  - Secondary text: `#64748B`

### Semantic Micro-Indicators
- **Online Presence:** `#10B981` (Emerald)
- **Away / Idle:** `#F59E0B` (Amber)
- **Offline / Do Not Disturb:** `#64748B` (Slate)
- **Urgent Notification / Mention:** `#EF4444` (Crimson)

## Typography

The typography uses a single, robust geometric sans-serif: **Inter**. Serif typefaces are completely prohibited. Inter provides exceptional letterform disambiguation at dense micro-sizes (`11px` to `14px`) via its tall x-height and neutral grotesque mechanics. Inline code, hashes, and payload snippets utilize **JetBrains Mono** for structural precision.

- **Headlines:** Clean semi-bold structures with subtle negative letter-spacing to prevent visual bleed on backlit displays.
- **Message Content:** Standardized at `body-md` (`14px` with a comfortable `22px` line-height) to maximize reading endurance during heavy threaded technical discussions.
- **Metadata and Badges:** `label-sm` rendered in `font-weight: 600` with subtle uppercase tracking for section headers, keyboard shortcuts, and presence indicators.

## Elevation & Depth

This design system rejects heavy drop shadows, glowing volumetric cards, and layered blur effects in favor of **Tonal Layering and Crisp Micro-Borders**.

- **Z-0 (Base Canvas):** `#090D16` in dark mode (`#F8F9FA` in light mode). Lowest baseline plane for stream activity.
- **Z-1 (Sidebar / Structural Panels):** Separated by an unambiguous `1px solid #1E293B` border rather than shadow elevation.
- **Z-2 (Docked Elements & Popovers):** Modals, dropdown menus, and the sticky composer surface use a single ambient, ultra-subtle contact shadow: `0 4px 12px rgba(0, 0, 0, 0.35)`, bounded by a `1px solid #334155` edge highlight.
- **Hover & Interaction States:** Surfaces indicate focus through direct surface color shifts (e.g., `#0D1322` to `#131B2E`) and subtle border emphasis, avoiding pseudo-3D lifting.

## Shapes

The design system operates strictly with **Soft Geometry (Level 1)**. Rounded bubble aesthetics are completely prohibited to maintain enterprise efficiency and high tabular data fidelity.

- **Base Controls (`rounded` / `0.25rem` / `4px`):** Checkboxes, reaction chips, code snippets, status badges, and channel selection highlights.
- **Containers & Surfaces (`rounded-md` / `0.375rem` / `6px`):** Popover cards, modal dialogs, message action toolbars, and attachment cards.
- **Input Fields & Composer (`rounded-lg` / `0.5rem` / `8px`):** The message composer dock and primary search bar.
- **Avatars & Presence Dots:** Avatars employ a tailored square-radius (`6px` rounded corners) to distinguish user presence from circular consumer chat apps. Status dots remain strictly circular (`50%` radius) for instant optical recognition.

## Components

### 1. Message Items
- **Format:** Linear, row-based layout (no chat bubbles).
- **Structure:** Left column accommodates a `36x36px` rounded avatar. Right column contains the message header (Name in `font-weight: 600`, timestamp in `text-xs text-slate-400`, inline role badge), followed by rich-text message body.
- **Hover Toolbar:** Micro-action bar floating top-right on hover (`1px solid #1E293B`, background `#131B2E`) featuring quick reactions, reply in thread, bookmark, and more options.

### 2. Message Composer
- **Visuals:** Framed container docked at the bottom of the stream. Background `#0D1322`, border `1px solid #1E293B`.
- **Top Bar:** WYSIWYG tools (Bold, Italic, Code, Link, List).
- **Input Area:** Auto-expanding plaintext or markdown editor with `14px` typography.
- **Bottom Bar:** Left side contains file attachment, code snippet trigger, and emoji picker; right side contains keyboard guide (`Enter` to send, `Shift+Enter` for newline) and a compact Cobalt send button.

### 3. Reaction Chips
- **Resting:** Micro-pill (`24px` height, `4px` radius), border `1px solid #1E293B`, background `#090D16`, containing emoji and count (`12px`).
- **Active (User reacted):** Cobalt-tinted background (`rgba(37, 99, 235, 0.15)`), border `1px solid #2563EB`, text `#60A5FA`.

### 4. Direct Message & Channel List Items
- **Channel Item:** `#` icon in slate, label in `14px` medium. Unread state triggers bold white text and a right-aligned compact Cobalt numerical badge. Active channel applies background `#1E293B` and white text.
- **DM Item:** `20x20px` square-rounded avatar with absolute positioned `6px` status dot. Name truncated with ellipsis, accompanied by an optional muted status icon.

### 5. Input Fields & Search (Quick Switcher)
- Search triggers a centered command palette modal.
- Input contains a search icon prefix, `14px` text, and a right-aligned `Cmd + K` keycap badge (`border: 1px solid #334155`, `font-size: 11px`).

### 6. Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, hover `#1D4ED8`, height `36px`, padding `0 14px`, border-radius `4px`.
- **Secondary:** Background `transparent`, border `1px solid #334155`, text `#F1F5F9`, hover background `#1E293B`.
- **Ghost:** Background `transparent`, text `#94A3B8`, hover text `#FFFFFF`, hover background `#1E293B`.

### 7. Empty States
- Dignified technical placeholder: Centered muted icon (`32x32px` in `#475569`), clear title in `headline-sm`, single-sentence description in `body-sm text-slate-400`, followed by 2-3 inline keybinding pills (`G then C` for channel navigation, `Cmd+K` for global switch).