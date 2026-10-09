# Blur My Page

A lightweight Chrome extension that places a polished live-blur screen over an idle webpage. It is designed for personal homepages and other pages you may not want visible while changing tabs or sharing your screen.

> **Privacy screen, not security:** Blur My Page does not remove, encrypt, or protect the underlying webpage. It prevents casual glances only. A user with access to the browser can inspect the page or disable the extension.

## What it does

- Starts pages **unlocked**, then blurs them after 3 minutes of inactivity by default.
- Resets the timer on pointer, keyboard, scroll, and touch activity.
- Lets you blur the active tab immediately from the extension popup.
- Supports click-to-reveal or password-to-reveal unlock modes.
- Keeps settings locally in Chrome, including a SHA-256 hash of the password (never the plaintext password).
- Applies to `http` and `https` websites. Chrome-owned pages such as `chrome://` cannot be modified by extensions.

## Install locally

This extension uses no bundler or installed dependencies.

1. Clone or download this repository.
2. In Chrome, visit `chrome://extensions`.
3. Enable **Developer mode** in the upper-right corner.
4. Choose **Load unpacked** and select this repository folder.
5. Pin **Blur My Page** from the extensions toolbar, then open its popup to configure it.

When source files change, return to `chrome://extensions` and click the extension's reload icon.

## Use

1. Keep **Privacy screen** enabled and choose an idle timeout (three minutes is the default).
2. Choose **Click** for a one-click reveal, or choose **Password**, enter a password, and let the popup save it.
3. Use **Blur this tab now** whenever you need to hide the active website immediately.
4. Once blurred, use the selected unlock flow to reveal the current page. Activity then starts a fresh idle timer.

## Development checks

```sh
npm run check
```

The command uses Node's syntax checks and verifies the required Manifest V3 fields. Manual verification should cover both unlock modes, timer reset from page activity, popup-driven manual blur, persistence after browser restart, and safe failure on Chrome-owned pages.

## Project layout

- `manifest.json` — Chrome Manifest V3 configuration
- `src/content/` — isolated page overlay and idle tracking
- `src/popup/` — popup-only settings interface
- `src/shared/settings.js` — local setting storage and password hashing
- `public/icons/` — extension icons
