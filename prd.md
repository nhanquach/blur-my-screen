# Project PRD & Product Brief: BlurMyScreen

**Product Name:** BlurMyScreen
**Platform:** Chrome Extension (Manifest V3) & In-Page DOM Privacy Shield  
**Brand Identity:** Matcha & Botanical Sanctuary (Pastel Minimal, Warm Ceramic & Organic Soft Tones)  
**Status:** Design Milestone Completed (Ready for Engineering Hand-off)

---

## 1. Executive Summary & Vision

BlurMyScreen is an ambient, privacy-first browser extension designed for professionals working in public spaces (cafes, transit, open-plan offices) or sharing screens during remote calls. Rather than aggressive security lockouts, BlurMyScreen provides serene, configurable cloaking mechanisms—ranging from targeted PII masking to full-page frosted veils—triggered automatically upon inactivity or switched contexts.

### Value Proposition

- **Effortless Confidentiality:** Automatically defuses shoulder-surfing risk without disrupting workflow.
- **Warm, Approachable UX:** Moves away from clinical, alarming security software towards a mindful, botanical aesthetic.
- **Zero-Trust Local Execution:** 100% on-device heuristic detection and CSS/DOM cloaking with zero server data transfer.

---

## 2. Core Personas & Use Cases

1. **The Remote Nomad & Cafe Worker:** Needs automated protection when stepping away for coffee or when sitting in high-traffic shared spaces.
2. **The Executive & Finance Leader:** Frequently views sensitive revenue charts, PII tables, and employee compensation data during meetings and screen shares.
3. **The Healthcare & Compliance Specialist:** Handles medical/legal records requiring strict visual privacy under GDPR, CCPA, and HIPAA compliance policies.

---

## 3. Product Features & Specifications

### 3.1. Extension Popup (380px Floating Sheet)

- **Master Shield Toggle:** Springy toggle switching state between _Protecting_ (live pulse dot) and _Paused_.
- **Inactivity Timer Configuration:** Granular preset pills (`15s`, `30s`, `1m`, `3m`, `5m`) with live idle countdown telemetry. Resets on keyboard events, mouse movement, or scroll actions.
- **Cloak Appearance Modes:**
  - **Frosted (Matcha Mist):** Translucent organic diffusion (`backdrop-filter: blur()`).
  - **Dimmed:** Neutral low-luminance veil.
  - **Minimal:** Solid, opaque ceramic mask.
- **Granular Blur Intensity Slider:** Real-time calibration from `4px` to `40px` with a live interactive confidential card preview containing instant `[Peek]` hold-to-reveal testing.
- **Smart Behavioral Triggers:**
  - _Pause when media is playing_ (e.g. YouTube, presentation videos).
  - _Blur upon switching tabs or unfocusing the window_.

### 3.2. In-Page Content Shield (Targeted PII Masking)

- **Heuristic & Regex DOM Scanners:** Detects and applies localized frosted capsules over legal names, email addresses, credit card numbers, and currency metrics.
- **Inline Peek Affordance:** Hover + `Shift` to momentarily dissolve targeted blur with audited zero-screenshot footprint.
- **Status Pills:** Real-time badge indicators (e.g., `🔒 14 PII Fields Masked`, `DOM Mutation Guard: ON`).

### 3.3. Full-Page Active Cloak & Minimal HUD

- **Encompassing Veil:** Translucent frosted veil (`#F4F5F0` diffusion with ambient botanical micro-dots) masking full viewport content.
- **Streamlined Floating HUD Capsule:**
  - Lightweight porcelain capsule floating centered above the blur.
  - Friendly botanical brand mark + active status indicator.
  - Primary Action Pill: Tactile matcha button `Unblur` with integrated `Space` keyboard shortcut.
  - Quick utility affordances: `Tune` (intensity presets) and `Lock` (hard-lock screen).
- **Global Hotkeys:**
  - `Space` (Hold): Temporary peek reveal.
  - `Esc`: Instant manual lock / force cloak.
  - `⌘M` / `Ctrl+M`: Selective marquee reveal area.

---

## 4. Design System & Visual Language

- **Design System Token:** `Serene Surface` / `Matcha & Botanical Studio`
- **Primary Accent Palette:**
  - Brand Primary / Matcha: `#3d5a49` (Deep Matcha Green)
  - Surface Foundation: `#fbf9f6` (Warm Linen / Porcelain)
  - Container Low / Mist: `#f5f3f0`
  - Outline / Borders: Muted sage & botanical borders with 20–30% opacity.
- **Typography:** Manrope, geometric sans with calm legibility.
- **Corner Radii:** Soft 8px–16px rounded capsules (`ROUND_EIGHT` token scale).
- **Haptic Micro-Interactions:** Subtle scale transitions (`active:scale-95`), springy toggle animations, and fluid fade transitions adhering to `prefers-reduced-motion`.

---

## 5. Technical Architecture & Non-Functional Requirements

| Dimension               | Specification                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Platform**            | Chromium Manifest V3 (Chrome, Edge, Brave, Arc)                                      |
| **Storage**             | `chrome.storage.local` for zero-leak local user preferences                          |
| **Performance**         | Sub-16ms blur activation using GPU-accelerated CSS `backdrop-filter`                 |
| **Privacy / Telemetry** | Zero external analytics; all DOM masking and timer logic computed entirely on client |
| **Mutation Resilience** | `MutationObserver` integration to mask dynamically loaded infinite-scroll data       |

---

## 6. Milestones & Implementation Roadmap

1. **Milestone 1 (Popup UI & Storage):** Integrate popup DOM with `chrome.storage.sync` and Manifest V3 background service workers.
2. **Milestone 2 (Inactivity & Tab State Listener):** Implement idle API (`chrome.idle.queryState`) and visibility change triggers.
3. **Milestone 3 (Content Script Cloak Engine):** Inject CSS backdrop masks, floating HUD capsule, and hotkey listeners (`Space`, `Esc`).
4. **Milestone 4 (Smart Regex Heuristics):** Add automated recognition for credit cards, emails, and financial figures.
5. **Milestone 5 (Store Packaging & Release):** Chrome Web Store assets, privacy policy documentation, and launch v1.0.
