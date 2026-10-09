(() => {
  'use strict';

  const STORAGE_KEY = 'blurMyScreenSettings'; // Renamed from blurMyPageSettings to align with PRD product name
  const OLD_STORAGE_KEY = 'blurMyPageSettings';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    idleTimeoutSeconds: 180,
    cloakMode: 'frosted',
    blurIntensityPx: 20,
    brightnessPercent: 70,
    pauseWhenMediaPlaying: true,
    cloakOnFocusLoss: true,
    targetedMaskingEnabled: true,
    piiDisabledOrigins: [],
    hideHUD: false,
  });

  function normalizeOrigin(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
    } catch {
      return null;
    }
  }

  function normalizeOrigins(origins) {
    return [...new Set((Array.isArray(origins) ? origins : [])
      .map(normalizeOrigin)
      .filter(Boolean))].slice(0, 200);
  }

  function normalize(settings = {}) {
    return {
      enabled: settings.enabled !== false,
      // Allow a custom timeout from 5 seconds to one hour; the popup still
      // offers common presets for quick selection.
      idleTimeoutSeconds: Math.min(3600, Math.max(5, Math.round(Number(settings.idleTimeoutSeconds) || DEFAULT_SETTINGS.idleTimeoutSeconds))),
      cloakMode: ['frosted', 'dimmed', 'minimal'].includes(settings.cloakMode) ? settings.cloakMode : 'frosted',
      blurIntensityPx: Math.min(40, Math.max(4, Number(settings.blurIntensityPx) || DEFAULT_SETTINGS.blurIntensityPx)),
      brightnessPercent: Math.min(100, Math.max(40, Number(settings.brightnessPercent) || DEFAULT_SETTINGS.brightnessPercent)),
      pauseWhenMediaPlaying: settings.pauseWhenMediaPlaying !== false,
      cloakOnFocusLoss: settings.cloakOnFocusLoss !== false,
      targetedMaskingEnabled: settings.targetedMaskingEnabled !== false,
      piiDisabledOrigins: normalizeOrigins(settings.piiDisabledOrigins),
      hideHUD: settings.hideHUD === true,
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

  function isPiiMaskingEnabledForOrigin(settings, origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    return Boolean(settings?.targetedMaskingEnabled) && Boolean(normalizedOrigin) && !normalizeOrigins(settings?.piiDisabledOrigins).includes(normalizedOrigin);
  }

  async function setPiiMaskingForOrigin(origin, enabled) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) throw new TypeError('PII masking exceptions require an http(s) origin.');
    const settings = await get();
    const disabledOrigins = new Set(settings.piiDisabledOrigins);
    if (enabled) disabledOrigins.delete(normalizedOrigin);
    else disabledOrigins.add(normalizedOrigin);
    return save({ piiDisabledOrigins: [...disabledOrigins] });
  }

  window.BlurMyScreenSettings = { DEFAULT_SETTINGS, get, save, normalizeOrigin, isPiiMaskingEnabledForOrigin, setPiiMaskingForOrigin };
})();
