(() => {
  'use strict';

  const STORAGE_KEY = 'blurMyScreenSettings'; // Renamed from blurMyPageSettings to align with PRD product name
  const OLD_STORAGE_KEY = 'blurMyPageSettings';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    idleTimeoutSeconds: 180,
    cloakMode: 'frosted',
    blurIntensityPx: 20,
    pauseWhenMediaPlaying: true,
    cloakOnFocusLoss: true,
    targetedMaskingEnabled: true,
  });

  function normalize(settings = {}) {
    return {
      enabled: settings.enabled !== false,
      idleTimeoutSeconds: [15, 30, 60, 180, 300].includes(Number(settings.idleTimeoutSeconds))
        ? Number(settings.idleTimeoutSeconds)
        : DEFAULT_SETTINGS.idleTimeoutSeconds,
      cloakMode: ['frosted', 'dimmed', 'minimal'].includes(settings.cloakMode)
        ? settings.cloakMode
        : DEFAULT_SETTINGS.cloakMode,
      blurIntensityPx: Math.min(40, Math.max(4, Number(settings.blurIntensityPx) || DEFAULT_SETTINGS.blurIntensityPx)),
      pauseWhenMediaPlaying: settings.pauseWhenMediaPlaying !== false,
      cloakOnFocusLoss: settings.cloakOnFocusLoss !== false,
      targetedMaskingEnabled: settings.targetedMaskingEnabled !== false,
    };
  }

  async function migrate() {
    const oldStored = await chrome.storage.local.get(OLD_STORAGE_KEY);
    if (!oldStored[OLD_STORAGE_KEY]) return;

    const old = oldStored[OLD_STORAGE_KEY];
    const migrated = {
      enabled: old.enabled,
      idleTimeoutSeconds: (Number(old.idleMinutes) || 3) * 60,
      // Other settings use defaults
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: normalize(migrated) });
    await chrome.storage.local.remove(OLD_STORAGE_KEY);
  }

  async function get() {
    await migrate();
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalize(stored[STORAGE_KEY]);
  }

  async function save(partialSettings) {
    const settings = { ...(await get()), ...partialSettings };
    const normalized = normalize(settings);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  window.BlurMyScreenSettings = { DEFAULT_SETTINGS, get, save };
})();
