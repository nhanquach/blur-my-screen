(() => {
  'use strict';

  const STORAGE_KEY = 'blurMyPageSettings';
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    unlockMode: 'click',
    idleMinutes: 3,
    passwordHash: '',
  });

  function normalize(settings = {}) {
    return {
      enabled: settings.enabled !== false,
      unlockMode: settings.unlockMode === 'password' ? 'password' : 'click',
      idleMinutes: Math.min(120, Math.max(1, Number(settings.idleMinutes) || DEFAULT_SETTINGS.idleMinutes)),
      passwordHash: typeof settings.passwordHash === 'string' ? settings.passwordHash : '',
    };
  }

  async function get() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalize(stored[STORAGE_KEY]);
  }

  async function save(partialSettings) {
    const settings = { ...(await get()), ...partialSettings };
    const normalized = normalize(settings);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  window.BlurMyPageSettings = { DEFAULT_SETTINGS, get, save, hashPassword };
})();
