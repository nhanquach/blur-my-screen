(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector); let envelope;
  async function render() {
    envelope = await window.BlurMyScreenSettings.getEnvelope();
    $('#profile').replaceChildren(...envelope.profiles.map((profile) => { const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name; option.selected = profile.id === envelope.activeProfileId; return option; }));
    $('#profile-description').textContent = 'Select the baseline profile used unless a site rule overrides it.';
    const rules = $('#rules'); rules.replaceChildren(...envelope.siteRules.map((rule) => { const item = document.createElement('li'); const text = document.createElement('span'); text.textContent = `${rule.origin} — ${rule.profileId || 'default profile'}, PII ${rule.overrides?.targetedMaskingEnabled === false ? 'off' : 'on'}`; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.addEventListener('click', async () => { const next = await window.BlurMyScreenSettings.getEnvelope(); next.siteRules = next.siteRules.filter((item) => item.origin !== rule.origin); await chrome.storage.local.set({ [window.BlurMyScreenSettings.STORAGE_KEY]: next }); render(); }); item.append(text, remove); return item; }));
  }
  $('#profile').addEventListener('change', async (event) => { await window.BlurMyScreenSettings.setActiveProfile(event.target.value); render(); });
  $('#rule-form').addEventListener('submit', async (event) => { event.preventDefault(); const origin = window.BlurMyScreenSettings.normalizeOrigin($('#origin').value); if (!origin) { $('#status').textContent = 'Enter a full http(s) origin.'; return; } const next = await window.BlurMyScreenSettings.getEnvelope(); const rule = { id: `origin:${origin}`, origin, ...( $('#always-protect').checked ? { profileId: 'strict' } : {}), overrides: { targetedMaskingEnabled: $('#mask-pii').checked } }; const index = next.siteRules.findIndex((item) => item.origin === origin); if (index >= 0) next.siteRules[index] = rule; else next.siteRules.push(rule); await chrome.storage.local.set({ [window.BlurMyScreenSettings.STORAGE_KEY]: next }); $('#status').textContent = 'Site rule saved locally.'; event.target.reset(); render(); });
  render();
})();
