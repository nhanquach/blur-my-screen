# Chrome Web Store listing draft

**Name:** BlurMyScreen

**Summary:** Local-only visual privacy for browsers: automatic cloaks, screen-share presentation mode, and heuristic PII masking.

**Description:** BlurMyScreen helps reduce casual shoulder-surfing while working in public or sharing a screen. Configure inactivity cloaks, focus-loss protection, local profiles and per-site rules. PII masks run in your browser and no page text leaves your device.

**Privacy disclosure:** No data is sold or transferred. Page text is processed transiently on-device. No analytics or remote code is used.

**Single purpose:** Visual privacy for webpages: hide on-screen content from onlookers by cloaking the page or masking sensitive text.

**Permission justifications (dashboard Privacy tab):**
- `storage`: saves the user's preferences, profiles, and site rules locally.
- `idle`: cloaks the active page when the device goes idle or locks.
- `windows`: cloaks the page when the browser window loses focus (optional setting).
- Host access (content scripts on http/https): required to draw the privacy cloak over the page and to mask sensitive text on-device. No page data is read for any other purpose or transmitted.

**Remote code:** No. All code ships in the package.

**Data usage:** Collects no user data. Certify: not sold, not used for unrelated purposes, not used for creditworthiness.

**Category:** Productivity (suggested). **Language:** English.

Use only synthetic demo data in screenshots and promotional assets.
