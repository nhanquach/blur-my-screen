(() => {
  'use strict';

  const root = typeof window === 'undefined' ? self : window;
  const STORAGE_KEY = 'blurMyScreenSettings';
  const OLD_STORAGE_KEY = 'blurMyPageSettings';
  const SCHEMA_VERSION = 3;
  let writeQueue = Promise.resolve();

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true, idleTimeoutSeconds: 180, cloakMode: 'frosted', blurIntensityPx: 20,
    brightnessPercent: 70, pauseWhenMediaPlaying: true, cloakOnFocusLoss: true,
    targetedMaskingEnabled: true, hideHUD: false,
    pii: Object.freeze({ sensitivity: 'balanced', categories: Object.freeze({ email: true, paymentCard: true, currency: true, labeledName: true }), scope: 'viewport', maxMasks: 250, batchSize: 100, mutationDebounceMs: 200 }),
  });

  const BUILTIN_PROFILES = Object.freeze([
    { id: 'everyday', name: 'Everyday', config: DEFAULT_SETTINGS },
    { id: 'cafe', name: 'Café', config: { ...DEFAULT_SETTINGS, idleTimeoutSeconds: 60, cloakOnFocusLoss: true, blurIntensityPx: 28 } },
    { id: 'strict', name: 'High privacy', config: { ...DEFAULT_SETTINGS, idleTimeoutSeconds: 30, cloakMode: 'minimal', targetedMaskingEnabled: true, pii: { ...DEFAULT_SETTINGS.pii, sensitivity: 'strict' } } },
    // Presentation is intentionally manual-only for full-screen cloaks while retaining masking.
    { id: 'presentation', name: 'Presentation', config: { ...DEFAULT_SETTINGS, enabled: false, targetedMaskingEnabled: true, pii: { ...DEFAULT_SETTINGS.pii, sensitivity: 'strict' } } },
  ]);

  function normalizeOrigin(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.origin : null; } catch { return null; }
  }
  function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback; }
  function normalizePii(pii = {}) {
    const categories = pii.categories || {};
    return {
      sensitivity: ['conservative', 'balanced', 'strict'].includes(pii.sensitivity) ? pii.sensitivity : DEFAULT_SETTINGS.pii.sensitivity,
      categories: { email: categories.email !== false, paymentCard: categories.paymentCard !== false, currency: categories.currency !== false, labeledName: categories.labeledName !== false },
      scope: pii.scope === 'document' ? 'document' : 'viewport',
      maxMasks: clamp(pii.maxMasks, 1, 1000, DEFAULT_SETTINGS.pii.maxMasks),
      batchSize: clamp(pii.batchSize, 20, 300, DEFAULT_SETTINGS.pii.batchSize),
      mutationDebounceMs: clamp(pii.mutationDebounceMs, 50, 2000, DEFAULT_SETTINGS.pii.mutationDebounceMs),
    };
  }
  function normalizeConfig(settings = {}) {
    return {
      enabled: settings.enabled !== false,
      idleTimeoutSeconds: clamp(settings.idleTimeoutSeconds, 5, 3600, DEFAULT_SETTINGS.idleTimeoutSeconds),
      cloakMode: ['frosted', 'dimmed', 'minimal'].includes(settings.cloakMode) ? settings.cloakMode : DEFAULT_SETTINGS.cloakMode,
      blurIntensityPx: clamp(settings.blurIntensityPx, 4, 40, DEFAULT_SETTINGS.blurIntensityPx),
      brightnessPercent: clamp(settings.brightnessPercent, 40, 100, DEFAULT_SETTINGS.brightnessPercent),
      pauseWhenMediaPlaying: settings.pauseWhenMediaPlaying !== false,
      cloakOnFocusLoss: settings.cloakOnFocusLoss !== false,
      targetedMaskingEnabled: settings.targetedMaskingEnabled !== false,
      hideHUD: settings.hideHUD === true,
      pii: normalizePii(settings.pii),
    };
  }
  function normalizeProfile(profile, index) {
    const fallback = BUILTIN_PROFILES[index] || BUILTIN_PROFILES[0];
    const id = typeof profile?.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(profile.id) ? profile.id : fallback.id;
    return { id, name: String(profile?.name || fallback.name).slice(0, 40), config: normalizeConfig(profile?.config || profile) };
  }
  function normalizeRule(rule) {
    const origin = normalizeOrigin(rule?.origin || rule?.match?.origin);
    if (!origin) return null;
    const profileId = typeof rule.profileId === 'string' ? rule.profileId : undefined;
    const overrides = rule.overrides && typeof rule.overrides === 'object' ? rule.overrides : {};
    return { id: typeof rule.id === 'string' ? rule.id.slice(0, 60) : `origin:${origin}`, origin, ...(profileId ? { profileId } : {}), overrides };
  }
  function normalizeEnvelope(value = {}) {
    // Legacy flat settings remain accepted as the default profile's configuration.
    const suppliedProfiles = Array.isArray(value.profiles) ? value.profiles : [{ id: 'everyday', name: 'Everyday', config: value }];
    const profiles = suppliedProfiles.map(normalizeProfile);
    const uniqueProfiles = profiles.filter((profile, index, all) => all.findIndex((item) => item.id === profile.id) === index).slice(0, 12);
    if (!uniqueProfiles.length) uniqueProfiles.push(normalizeProfile(BUILTIN_PROFILES[0], 0));
    for (const builtin of BUILTIN_PROFILES) if (!uniqueProfiles.some((profile) => profile.id === builtin.id)) uniqueProfiles.push(normalizeProfile(builtin));
    const rules = (Array.isArray(value.siteRules) ? value.siteRules : []).map(normalizeRule).filter(Boolean)
      .filter((rule, index, all) => all.findIndex((item) => item.origin === rule.origin) === index).slice(0, 200);
    // Migrate old per-origin PII exceptions into ordinary local site rules.
    for (const origin of Array.isArray(value.piiDisabledOrigins) ? value.piiDisabledOrigins.map(normalizeOrigin).filter(Boolean) : []) {
      if (!rules.some((rule) => rule.origin === origin)) rules.push({ id: `origin:${origin}`, origin, overrides: { targetedMaskingEnabled: false } });
    }
    const excludedOrigins = (Array.isArray(value.excludedOrigins) ? value.excludedOrigins : [])
      .map(normalizeOrigin).filter(Boolean).filter((origin, index, all) => all.indexOf(origin) === index).slice(0, 200);
    const activeProfileId = uniqueProfiles.some((profile) => profile.id === value.activeProfileId) ? value.activeProfileId : 'everyday';
    return { schemaVersion: SCHEMA_VERSION, activeProfileId, profiles: uniqueProfiles, siteRules: rules, excludedOrigins };
  }
  function mergeConfig(base, overrides) { return normalizeConfig({ ...base, ...overrides, pii: { ...(base.pii || {}), ...(overrides?.pii || {}), categories: { ...(base.pii?.categories || {}), ...(overrides?.pii?.categories || {}) } } }); }
  function resolve(envelope, origin, presentation = false) {
    const normalized = normalizeEnvelope(envelope);
    const normalizedOrigin = normalizeOrigin(origin);
    const rule = normalizedOrigin ? normalized.siteRules.find((item) => item.origin === normalizedOrigin) : null;
    const excluded = Boolean(normalizedOrigin && normalized.excludedOrigins.includes(normalizedOrigin));
    const profileId = presentation ? 'presentation' : rule?.profileId || normalized.activeProfileId;
    const profile = normalized.profiles.find((item) => item.id === profileId) || normalized.profiles[0];
    const config = mergeConfig(profile.config, rule?.overrides);
    return { ...config, ...(excluded ? { enabled: false, targetedMaskingEnabled: false } : {}), profileId: profile.id, profileName: profile.name, siteRule: rule || null, excluded, presentation: Boolean(presentation) };
  }
  async function migrate() {
    const stored = await chrome.storage.local.get([STORAGE_KEY, OLD_STORAGE_KEY]);
    const current = stored[STORAGE_KEY];
    if (current?.schemaVersion === SCHEMA_VERSION) return normalizeEnvelope(current);
    const old = current || stored[OLD_STORAGE_KEY] || {};
    const flat = stored[OLD_STORAGE_KEY] && !current ? { ...old, idleTimeoutSeconds: (Number(old.idleMinutes) || 3) * 60 } : old;
    const migrated = normalizeEnvelope(flat);
    await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
    if (stored[OLD_STORAGE_KEY]) await chrome.storage.local.remove(OLD_STORAGE_KEY);
    return migrated;
  }
  async function getEnvelope() { return migrate(); }
  async function get(origin, presentation = false) { return resolve(await getEnvelope(), origin, presentation); }
  function enqueue(mutator) {
    writeQueue = writeQueue.catch(() => undefined).then(async () => {
      const next = normalizeEnvelope(await getEnvelope());
      await mutator(next);
      const normalized = normalizeEnvelope(next);
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
      return normalized;
    });
    return writeQueue;
  }
  async function save(partial, origin) {
    const envelope = await enqueue((next) => {
      const profile = next.profiles.find((item) => item.id === next.activeProfileId) || next.profiles[0];
      profile.config = mergeConfig(profile.config, partial);
    });
    return resolve(envelope, origin);
  }
  async function setActiveProfile(profileId) {
    const envelope = await enqueue((next) => { if (next.profiles.some((profile) => profile.id === profileId)) next.activeProfileId = profileId; });
    return resolve(envelope);
  }
  async function setPiiMaskingForOrigin(origin, enabled) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) throw new TypeError('PII masking exceptions require an http(s) origin.');
    const envelope = await enqueue((next) => {
      const existing = next.siteRules.find((rule) => rule.origin === normalizedOrigin);
      if (existing) existing.overrides = { ...existing.overrides, targetedMaskingEnabled: Boolean(enabled) };
      else next.siteRules.push({ id: `origin:${normalizedOrigin}`, origin: normalizedOrigin, overrides: { targetedMaskingEnabled: Boolean(enabled) } });
    });
    return resolve(envelope, normalizedOrigin);
  }
  async function setSiteExcluded(origin, excluded) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) throw new TypeError('Excluded sites require an http(s) origin.');
    const envelope = await enqueue((next) => {
      const origins = new Set(next.excludedOrigins);
      if (excluded) origins.add(normalizedOrigin); else origins.delete(normalizedOrigin);
      next.excludedOrigins = [...origins];
    });
    return resolve(envelope, normalizedOrigin);
  }
  function isPiiMaskingEnabledForOrigin(settings, origin) { return Boolean(resolve({ profiles: [{ id: 'everyday', name: 'Everyday', config: settings }], activeProfileId: 'everyday' }, origin).targetedMaskingEnabled && normalizeOrigin(origin)); }

  root.BlurMyScreenSettings = { STORAGE_KEY, SCHEMA_VERSION, DEFAULT_SETTINGS, BUILTIN_PROFILES, normalizeOrigin, normalizeConfig, normalizeEnvelope, resolve, getEnvelope, get, save, setActiveProfile, setPiiMaskingForOrigin, setSiteExcluded, isPiiMaskingEnabledForOrigin };
})();
