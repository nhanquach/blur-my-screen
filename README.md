# BlurMyScreen

BlurMyScreen is an ambient, privacy-first browser extension designed for professionals working in public spaces or sharing screens during remote calls. It provides serene, configurable cloaking mechanisms—from targeted PII masking to full-page frosted veils—triggered automatically upon inactivity or switched contexts.

## 🌿 Vision & Design
BlurMyScreen moves away from clinical security software towards a mindful, botanical aesthetic. It uses a "Matcha & Botanical" design system characterized by warm linen surfaces, soft sage borders, and organic frosted diffusion.

## 🚀 Features

- **Automated Privacy Shield:** Automatically blurs the page after a configurable idle period (15s to 5m).
- **Smart Behavioral Triggers:**
  - **Media Awareness:** Automatically pauses the remaining idle timer while audio or video plays, then resumes that remaining time when playback stops.
  - **Context Awareness:** Can be configured to blur immediately upon window unfocus or tab switching.
- **Configurable Cloaking:**
  - **Frosted (Matcha Mist):** Organic diffusion using GPU-accelerated backdrop-filters.
  - **Dimmed:** Neutral low-luminance veil.
  - **Minimal:** Solid, opaque ceramic mask.
- **Targeted PII Masking:** Conservative, bounded on-device detection of emails, Luhn-valid card numbers, currency values, and explicitly labelled names. It scans visible content in idle-time batches, reports a local count by category, and offers a `Shift + Hover` peek affordance.
- **Profiles and per-site rules:** Choose Everyday, Café, High privacy, or Presentation defaults, then add exact-origin local overrides from Settings. Exclude the current site in one click from the popup, or manage excluded sites in Settings; excluded sites receive no cloaking or PII masking. Presentation mode is tab-session scoped: PII masking stays active while full-page cloaks are manual-only.
- **In-Page HUD:** A lightweight porcelain capsule for quick unblurring, tuning, and status monitoring. Hiding the capsule leaves a persistent, labeled Unblur button on every locked page.
- **Power-User Hotkeys:**
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
- **Transparent local controls:** The popup reports mask count, scan-limit state, effective profile, and whether the mutation guard is active. It never exposes the masked values.
- **Privacy Screen, Not Security:** This is a visual privacy shield to prevent casual shoulder-surfing. It does not encrypt or remove the underlying webpage content.

### Permissions and limitations

- `storage` saves preferences locally; `tabs`, `idle`, and `windows` coordinate the active page with system-idle and focus-loss events. The extension does not read, retain, or transmit page text.
- PII masking is a conservative visual heuristic for emails, Luhn-valid card-like numbers, common currency values, and explicitly labelled names. It can miss values or mask benign text, so it must not be relied on as a data-loss-prevention control.
- The HUD and popup controls are keyboard accessible. Holding `Space` temporarily peeks, and `Cmd/Ctrl+M` enables a marquee reveal; `Esc` exits that temporary marquee mode without changing the page's normal Escape behavior. The popup's `[Peek]` control supports press-and-hold with keyboard, mouse, and touch. Reduced-motion preferences disable overlay transitions.
- Browser-internal pages such as `chrome://`, extension galleries, and other restricted pages cannot be injected or protected; the popup identifies those pages as unsupported.

## 🧪 Development

```sh
npm run check
npm test
```

The check command validates syntax and the Manifest V3 configuration. The test command covers timer behavior, settings/profile resolution, and PII matching. See `docs/privacy-policy.md`, `docs/chrome-web-store-listing.md`, and `docs/release-checklist.md` for release material.
