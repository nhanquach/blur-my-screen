# Release checklist

- [ ] Run `npm run check` and `npm test`.
- [ ] Smoke test Chrome, Edge, Brave: supported pages, restricted URLs, navigation, manual lock restoration, idle/focus locks, media pause, and presentation mode.
- [ ] Test a large SPA/infinite-scroll page: scanning stays responsive, dynamic visible content is masked, and the scan limit is shown.
- [ ] Verify each profile and exact-origin rule; remove test rules.
- [ ] Confirm no real PII appears in store assets.
- [ ] Review `docs/privacy-policy.md` and set the public policy URL.
- [ ] Update version, store listing, screenshots, and changelog before upload.
