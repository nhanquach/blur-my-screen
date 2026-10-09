# BlurMyScreen

BlurMyScreen is an ambient, privacy-first browser extension designed for professionals working in public spaces or sharing screens during remote calls. It provides serene, configurable cloaking mechanisms—from targeted PII masking to full-page frosted veils—triggered automatically upon inactivity or switched contexts.

## 🌿 Vision & Design
BlurMyScreen moves away from clinical security software towards a mindful, botanical aesthetic. It uses a "Matcha & Botanical" design system characterized by warm linen surfaces, soft sage borders, and organic frosted diffusion.

## 🚀 Features

- **Automated Privacy Shield:** Automatically blurs the page after a configurable idle period (15s to 5m).
- **Smart Behavioral Triggers:**
  - **Media Awareness:** Automatically pauses the idle timer when audio or video is playing.
  - **Context Awareness:** Can be configured to blur immediately upon window unfocus or tab switching.
- **Configurable Cloaking:**
  - **Frosted (Matcha Mist):** Organic diffusion using GPU-accelerated backdrop-filters.
  - **Dimmed:** Neutral low-luminance veil.
  - **Minimal:** Solid, opaque ceramic mask.
- **Targeted PII Masking:** Heuristic detection of emails, credit card numbers, and currency metrics with a "Shift + Hover" peek affordance.
- **In-Page HUD:** A lightweight porcelain capsule for quick unblurring, tuning, and status monitoring.
- **Power-User Hotkeys:**
  - `Esc`: Instant manual lock.
  - `Space` (Hold): Temporary peek reveal.
  - `Cmd+M` / `Ctrl+M`: Selective marquee reveal area.

## 🛠 Installation (Developer Mode)

1. Clone this repository.
2. In Chrome, visit `chrome://extensions`.
3. Enable **Developer mode** in the upper-right corner.
4. Choose **Load unpacked** and select this repository folder.
5. Pin **BlurMyScreen** from the extensions toolbar.

## 🔒 Privacy & Security
- **Zero-Trust Local Execution:** 100% on-device detection and cloaking.
- **No Data Transfer:** Zero server data transfer; all preferences are stored in `chrome.storage.local`.
- **No Analytics:** Zero external analytics or telemetry.
- **Privacy Screen, Not Security:** This is a visual privacy shield to prevent casual shoulder-surfing. It does not encrypt or remove the underlying webpage content.

## 🧪 Development

```sh
npm run check
```

The check command validates the Manifest V3 configuration and ensures all required source files are present.
