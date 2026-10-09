# BlurMyScreen — PRD Alignment Plan

## Goal
Evolve the current Manifest V3 extension from an idle-only, password-unlock overlay into **BlurMyScreen**: a local-only privacy shield with Matcha & Botanical styling, configurable full-page cloaking, targeted PII masking, smart triggers, and an in-page HUD.

## Current-state gaps
The existing extension has local settings, a minutes-based idle timer, manual lock, and click/password reveal. It lacks the PRD’s popup controls, visual system, seconds presets/countdown, cloak modes/intensity, media and focus-loss triggers, background coordination, PII detection, mutation handling, HUD, and hotkeys.

## Product decisions to confirm
1. Use `chrome.storage.local`, not `sync`, to satisfy the PRD’s local-only preference requirement.
2. Remove password unlock and stored password hashes: they are outside the PRD and do not materially secure a browser session.
3. Treat popup lock, HUD Lock, and `Esc` as immediate manual cloaks, including when automatic protection is paused; explicit Unblur dismisses them.
4. Use conservative name recognition (label/context-based only) to avoid false positives; email, Luhn-validated cards, and currency values are the initial supported PII types.
5. Make marquee reveal temporary and dismissible (`Esc`/relock), rather than persistent.

## Implementation phases

### 1. Settings schema and migration
**Files:** `src/shared/settings.js`, new shared message constants if needed

- Replace `idleMinutes`, `unlockMode`, and `passwordHash` with validated settings:
  - `enabled`
  - `idleTimeoutSeconds`: `15`, `30`, `60`, `180`, `300`
  - `cloakMode`: `frosted`, `dimmed`, `minimal`
  - `blurIntensityPx`: integer `4`–`40`
  - `pauseWhenMediaPlaying`
  - `cloakOnFocusLoss`
  - `targetedMaskingEnabled`
- Add a one-time migration for existing settings (convert minutes to seconds and discard obsolete password fields).
- Centralize message names and setting normalization so popup, service worker, and content script share one contract.

### 2. MV3 background coordination
**Files:** `manifest.json`, new `src/background/service-worker.js`

- Register a service worker.
- Add only needed permissions: `storage`, `tabs`, `idle`, and `windows` if window-focus events are used.
- Coordinate system-idle and tab/window-focus events, forwarding control messages to injected content scripts.
- Keep `http`/`https` match patterns and gracefully ignore unsupported pages such as `chrome://`.
- Never collect, persist, or transmit page text.

### 3. Popup redesign
**Files:** `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`

- Rebuild as a 380px Matcha & Botanical floating sheet using porcelain surfaces, Matcha `#3d5a49`, soft sage borders, 8–16px radii, and reduced-motion support.
- Add the Protecting/Paused master toggle with live status pulse.
- Replace the select with preset timer pills: `15s`, `30s`, `1m`, `3m`, `5m`.
- Query the active tab for status and show a live remaining-time countdown, media-paused state, and unsupported-page state.
- Add Frosted/Dimmed/Minimal mode selection, a 4–40px intensity slider, and a confidential-card preview with hold-to-peek.
- Add media-playing and focus/tab-loss trigger switches plus a manual cloak action.

### 4. Cloak controller and smart triggers
**Files:** `src/content/content.js`, `src/content/overlay.css`

- Refactor into a per-tab controller with separate automatic timer and manual-lock state.
- Reset countdown on pointer, keyboard, touch, and scroll activity while the page is unlocked.
- Apply automatic cloaking on configured focus/visibility loss, worker idle messages, and elapsed local inactivity.
- Detect playing audio/video and pause/resume the automatic countdown based on settings, including dynamically added media.
- Expose structured status to the popup: lock state, remaining seconds, media state, active appearance settings, PII count, and mutation-guard status.

### 5. Full-page veil, HUD, and shortcuts
**Files:** `src/content/content.js`, `src/content/overlay.css`

- Replace the current dark blue card with isolated Shadow DOM UI: a `#F4F5F0` frosted veil, botanical micro-dots, and settings-driven Frosted/Dimmed/Minimal treatments.
- Add a centered porcelain HUD with brand/status indicator, Unblur action, Tune presets, Lock action, PII count, and mutation-guard status.
- Implement:
  - `Esc`: force immediate cloak
  - held `Space`: temporary page peek, restoring on key release/window blur
  - `Cmd+M` / `Ctrl+M`: marquee reveal selection
- Build marquee reveal with viewport panes surrounding the selection; clean it up on `Esc`, relock, and unload.

### 6. Targeted PII masking
**Files:** new `src/content/pii-scanner.js`, `manifest.json`, `src/content/content.js`

- Load the scanner before the main content controller.
- Scan visible safe text nodes only; skip scripts, styles, editable controls, extension UI, and previously processed content.
- Detect emails, Luhn-validated credit-card-like numbers, conservative currency patterns, and high-confidence labeled names.
- Add extension-owned inline frosted capsules without replacing entire interactive elements.
- Support scoped reveal only while hovering a capsule and holding `Shift`.
- Add a debounced `MutationObserver`, suppress self-generated changes, and keep the live mask count accurate.

### 7. Quality, privacy, packaging, and documentation
**Files:** `scripts/validate-manifest.js`, `package.json`, `README.md`

- Extend static checks to syntax-check new modules and validate service-worker, permissions, and content-script order.
- Document local-only processing, permissions rationale, heuristic limitations, accessibility behavior, unsupported pages, and unpacked installation.
- Do not add analytics, external network requests, screenshot/canvas capture, or remote fonts unless a local licensed font asset is bundled.

## Verification checklist

- [ ] All timer presets persist and reset on keyboard, pointer, touch, and scroll.
- [ ] System idle, focus/tab loss, manual lock, and media-playing behavior follow settings.
- [ ] Popup telemetry stays accurate for the active tab and handles unsupported pages safely.
- [ ] Each cloak mode and intensity applies correctly, including reduced-motion mode.
- [ ] HUD actions, `Esc`, held `Space`, and marquee reveal are keyboard accessible and clean up reliably.
- [ ] PII masks detect supported patterns, avoid editable/extension content, update after DOM mutations, and reveal only on hover + `Shift`.
- [ ] Settings persist across browser restart with no plaintext password or page data stored.
- [ ] `npm run check` passes; manual smoke testing succeeds in Chrome, Edge, Brave, dynamic/SPAs, and `chrome://` failure cases.

## Delivery order
1. Decisions and settings migration
2. Manifest/service worker
3. Popup controls and status protocol
4. Cloak controller and visual HUD
5. Smart triggers and hotkeys
6. PII scanner and mutation guard
7. Validation, performance tuning, documentation, and store-release assets
