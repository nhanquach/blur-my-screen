# BlurMyScreen Privacy Policy

BlurMyScreen processes page text transiently inside the browser to render local visual masks. It does not send, log, retain, sell, or analyze page text remotely. It has no analytics, accounts, network requests, or third-party services.

Preferences, profiles, and exact-origin site rules are stored with `chrome.storage.local`. Temporary manual-lock and presentation-mode state are stored in `chrome.storage.session` and expire with the browser session.

`storage` saves these local preferences. `windows` and `idle` coordinate visual locks and do not grant BlurMyScreen permission to transmit browsing data. The extension runs only on HTTP(S) pages and cannot protect browser-internal or otherwise restricted pages.

PII detection is an on-device visual heuristic. It may miss values or mask benign text; it is not a DLP, encryption, or compliance control.

Contact: qtrongnhan@gmail.com
