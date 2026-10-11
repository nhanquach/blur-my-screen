# BlurMyScreen

BlurMyScreen is a Manifest V3 Chrome extension that adds a visual privacy shield to webpages. It can cloak a page when you step away, lock it manually, and mask selected types of sensitive text locally. Its interface uses soft sage colors and frosted surfaces.

## Installation (Developer Mode)

1. Clone or download this repository; extract it if downloaded as a ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository folder containing `manifest.json`.
5. Pin **BlurMyScreen** from the extensions toolbar and open an HTTP or HTTPS webpage.

No build step or dependency installation is required. After installing or reloading the extension, reload existing webpages so the content scripts are available.

## Features

- **Automatic cloaking:** A page-local inactivity timer resets on pointer, keyboard, scroll, and touch activity. Choose 15s, 30s, 1m, 3m, or 5m presets, or a custom timeout from **5 seconds to 1 hour**. The default is 3 minutes.
- **System-idle protection:** Chrome's system-idle or device-lock signal can also cloak the active page independently of its page-local timer. System-idle detection uses a 15-second interval.
- **Focus-loss protection:** Optionally cloak when leaving the browser window or switching away from the tab.
- **Media awareness:** By default, playing HTML audio or video pauses the remaining inactivity countdown and suppresses automatic cloaking, including focus-loss and system-idle triggers. The countdown resumes when playback stops; manual locking remains available.
- **Three cloak styles:** **Frosted** uses backdrop blur with adjustable blur intensity (4–40px) and brightness (40–100%); **Dimmed** applies a dark veil; **Minimal** applies an opaque light cover.
- **Manual lock:** Use **Lock now** in the popup. Manual locks persist across reloads and navigation within the same tab during the browser session; automatic locks do not.
- **Targeted text masking:** Local heuristics detect email addresses, Luhn-valid payment-card-like numbers, common currency values, and explicitly labelled names. Choose Conservative, Balanced, or Strict sensitivity. The scanner watches text changes and schedules scans during browser idle time, with a default limit of 250 masks per page.
- **Profiles and site controls:** Choose Everyday, Café, High privacy, or Presentation as the default profile. Manage exact-origin exclusions and site rules in Settings, including per-site masking and the High privacy profile.
- **Tab-scoped presentation mode:** Uses the Presentation profile, whose defaults keep targeted masking on and make full-page cloaks manual-only. The tab mode survives navigation during the browser session.
- **In-page controls:** Locked pages show a capsule with Unblur, appearance cycling, and manual-lock controls. Hiding the capsule leaves a labelled **Unblur screen** button.

The popup shows the countdown, cloak state, effective profile, mask counts by category, and whether the mask limit has been reached.

## Usage and configuration

Open the toolbar popup to select a profile, adjust the timer, or lock the current page. Expand **Advanced settings** for appearance, automation, targeted masking, presentation mode, and HUD visibility. Use **Manage profiles & site rules** to open Settings.

Popup configuration changes are saved to the selected default profile. Site rules can override that profile. Exclusions take precedence over profiles and rules: excluded origins receive neither full-page cloaking nor targeted masking, and cannot be manually locked.

Site controls match an **exact origin** (scheme, hostname, and port), not a URL path or every subdomain. For example, excluding `https://example.com` does not exclude `https://app.example.com` or `http://example.com`.

The **Shield** switch controls automatic full-page cloaking; turning it off also clears an existing cloak. Targeted masking has its own switch, and **Lock now** still works with Shield off unless the site is excluded.

### Reveal controls

| Control | Action |
| --- | --- |
| **Unblur** | Remove the full-page cloak and restart the inactivity timer. |
| Hold **Space** while cloaked | Temporarily reveal the page behind the cloak; release to restore it. |
| **Cmd+M** / **Ctrl+M** while cloaked | Toggle marquee mode, then drag to reveal a rectangular area. |
| **Esc** in marquee mode | Exit marquee mode without unlocking. Outside marquee mode, Escape is left to the page. |
| **Shift + hover** over masked text | Temporarily reveal that mask. Keyboard focus also reveals an individual mask. |

Full-page reveal controls leave targeted text masks in place. The popup's **[Peek]** button is a press-and-hold control for the appearance preview, not the active webpage.

## Privacy, permissions, and limitations

- **Local processing:** Page text is inspected on-device for masking. Detected values are not saved or transmitted; there are no analytics, telemetry, or external services.
- **Local storage:** Preferences, profiles, site rules, and excluded origins use `chrome.storage.local`. Manual-lock and presentation state use `chrome.storage.session` for the current browser session.
- **Permissions:** `storage` saves configuration and session state; `idle` detects system inactivity; `windows` tracks browser focus. The extension does not request the `tabs` permission; content scripts report their own page origin to the popup. Content scripts run on HTTP and HTTPS webpages to apply cloaks and inspect text for masking.
- **Visual privacy only:** The extension does not encrypt, remove, or secure underlying content. Blur and dimming may leave information discernible, and the webpage can still access its original data. This is not a data-loss-prevention control or protection against malicious pages.
- **Heuristic coverage:** Masking can miss sensitive information or hide benign text. It scans rendered text nodes, not images, canvas content, form fields, or editable content. Content inside iframes and shadow roots is not covered by the current scanner. Scans are asynchronous and limited, so masking is not guaranteed before content becomes visible.
- **Supported pages:** Browser-internal pages, extension galleries, local files, and other restricted pages cannot be protected. The popup reports pages without a responding content script as unsupported.
- **Accessibility:** Popup and HUD controls support keyboard navigation, and individual text masks reveal on focus. Reduced-motion preferences disable cloak transitions.

## Development

Use Node.js with support for the built-in `node --test` runner:

```sh
npm run check
npm test
```

`npm run check` validates JavaScript syntax and the Manifest V3 configuration. `npm test` covers inactivity-timer behavior, settings/profile resolution, and PII matching. These are automated checks, not browser integration tests. `npm run build` is an alias for the checks; it does not generate a bundle.

### Packaging for the Chrome Web Store

```sh
npm run package
```

Runs the checks and tests, then writes `dist/blur-my-screen-<version>.zip` containing only `manifest.json`, `src/`, and `public/`. Upload that zip in the Chrome Web Store Developer Dashboard.

### Project structure

- `manifest.json` — extension registration, permissions, and content scripts.
- `src/background/` — system-idle/focus events and tab-session state.
- `src/content/` — full-page cloaks, reveal controls, and text scanning.
- `src/popup/` — toolbar controls and appearance preview.
- `src/options/` — default profile, exclusions, and site rules.
- `src/shared/` — settings, message types, timer logic, and PII matching.
- `test/` — Node.js unit tests.

### Release documentation

- [Privacy policy](docs/privacy-policy.md)
- [Chrome Web Store listing](docs/chrome-web-store-listing.md)
- [Release checklist](docs/release-checklist.md)
