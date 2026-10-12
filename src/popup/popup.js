(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const enabled = $('#enabled');
  const countdown = $('#countdown');
  const customTimeout = $('#custom-timeout');
  const intensity = $('#intensity');
  const intensityLabel = $('#intensity-label');
  const intensityValue = $('#intensity-value');
  const brightness = $('#brightness');
  const brightnessValue = $('#brightness-value');
  const brightnessControl = $('#brightness-control');
  const previewCard = $('#preview-card');
  const previewPeek = $('#preview-peek');
  const pauseMedia = $('#pause-media');
  const cloakFocus = $('#cloak-focus');
  const maskPii = $('#mask-pii');
  const sitePii = $('#site-pii');
  const sitePiiLabel = $('#site-pii-label');
  const sitePiiHelp = $('#site-pii-help');
  const hideHud = $('#hide-hud');
  const profile = $('#profile');
  const piiSensitivity = $('#pii-sensitivity');
  const presentation = $('#presentation');
  const toggleSiteExclusion = $('#toggle-site-exclusion');
  const siteExclusionHelp = $('#site-exclusion-help');
  const siteLockOnLoad = $('#site-lock-on-load');
  const siteLockOnLoadHelp = $('#site-lock-on-load-help');
  const status = $('#status');

  const MESSAGES = window.BlurMyScreenMessages;
  let countdownInterval;
  let sliderSaveTimer;
  let saveQueue = Promise.resolve();
  let activeOrigin;
  let currentSettings;
  let peekPointerId;
  let peekKeyboardActive = false;

  function updateCountdown() {
    clearInterval(countdownInterval);
    
    const update = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGES.STATUS });
        if (!response) throw new Error('No content response');
        if (Number.isFinite(response.remainingSeconds)) {
          const minutes = Math.floor(response.remainingSeconds / 60);
          const seconds = response.remainingSeconds % 60;
          countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          countdown.textContent = response.isMediaPlaying ? 'Paused for media' : response.locked ? 'Cloaked' : '--';
        }
        const categorySummary = response.categories && Object.entries(response.categories).map(([type, count]) => `${count} ${type}`).join(', ');
        const details = [response.excluded ? 'Excluded on this site' : response.locked ? 'Cloaked' : 'Protecting', response.excluded ? null : response.profileName || null, response.isMediaPlaying ? 'media playing' : null, response.count ? `${response.count} PII masked${categorySummary ? ` (${categorySummary})` : ''}` : null, response.capped ? 'scan limit reached' : null].filter(Boolean);
        status.textContent = details.join(' · ');
      } catch {
        countdown.textContent = '--';
        status.textContent = 'This page is unsupported.';
      }
    };


    update();
    countdownInterval = setInterval(update, 1000);
  }

  function selectedTimeoutSeconds() {
    const preset = document.querySelector('input[name="timeout"]:checked');
    if (preset) return Number(preset.value);

    const custom = Number(customTimeout.value);
    return Number.isFinite(custom) && custom >= 5 && custom <= 3600 ? Math.round(custom) : undefined;
  }

  function syncTimeoutControls(timeoutSeconds) {
    const preset = document.querySelector(`input[name="timeout"][value="${timeoutSeconds}"]`);
    document.querySelectorAll('input[name="timeout"]').forEach((radio) => { radio.checked = radio === preset; });
    customTimeout.value = preset ? '' : String(timeoutSeconds);
    const customSummary = document.querySelector('.custom-timeout summary');
    if (customSummary) customSummary.textContent = preset ? 'Custom timeout' : `Custom: ${timeoutSeconds}s`;
  }

  async function notifyActiveTabSettingsChanged() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: MESSAGES.SETTINGS_CHANGED }).catch(() => undefined);
  }

  function saveSettings() {
    const modeValue = document.querySelector('input[name="mode"]:checked')?.value;
    const timeoutSeconds = selectedTimeoutSeconds();
    
    const updates = {
      enabled: enabled.checked,
      ...(timeoutSeconds ? { idleTimeoutSeconds: timeoutSeconds } : {}),
      cloakMode: modeValue || undefined,
      blurIntensityPx: Number(intensity.value),
      brightnessPercent: Number(brightness.value),
      pauseWhenMediaPlaying: pauseMedia.checked,
      cloakOnFocusLoss: cloakFocus.checked,
      targetedMaskingEnabled: maskPii.checked,
      hideHUD: hideHud.checked,
      pii: { ...(currentSettings?.pii || {}), sensitivity: piiSensitivity.value },
    };

    saveQueue = saveQueue.catch(() => undefined).then(() => window.BlurMyScreenSettings.save(updates));
    return saveQueue.then((savedSettings) => {
      currentSettings = savedSettings;
      updateMasterLabel();
      updateSitePiiControl();
      // Do not wait for storage-change delivery: immediately update the page
      // so a disabled shield removes an already-visible cloak.
      notifyActiveTabSettingsChanged();
      return savedSettings;
    });
  }

  function updateMasterLabel() {
    enabled.setAttribute('aria-label', enabled.checked ? 'Privacy shield on' : 'Privacy shield off');
  }

  function updateSiteExclusionControl() {
    const siteName = activeOrigin ? new URL(activeOrigin).host : null;
    const isExcluded = currentSettings?.excluded === true;
    toggleSiteExclusion.disabled = !activeOrigin;
    $('#lock-now').disabled = !activeOrigin || isExcluded;
    toggleSiteExclusion.textContent = isExcluded ? 'Include site' : 'Exclude site';
    siteExclusionHelp.textContent = !siteName
      ? 'This page does not have a supported web origin.'
      : isExcluded
        ? `BlurMyScreen is off on ${siteName}.`
        : `Turn off BlurMyScreen for ${siteName}.`;
  }

  function updateSiteLockOnLoadControl() {
    const siteName = activeOrigin ? new URL(activeOrigin).host : null;
    const isExcluded = currentSettings?.excluded === true;
    siteLockOnLoad.disabled = !activeOrigin || isExcluded;
    siteLockOnLoad.checked = currentSettings?.lockOnLoad === true;
    siteLockOnLoadHelp.textContent = !siteName
      ? 'This page does not have a supported web origin.'
      : isExcluded
        ? `Include ${siteName} first to always lock it.`
        : siteLockOnLoad.checked
          ? `${siteName} opens cloaked every time it loads.`
          : `Open ${siteName} already cloaked until you unblur it.`;
  }

  async function saveSiteLockOnLoad() {
    if (!activeOrigin) return;
    const shouldLock = siteLockOnLoad.checked;
    siteLockOnLoad.disabled = true;
    try {
      currentSettings = await window.BlurMyScreenSettings.setSiteLockOnLoad(activeOrigin, shouldLock);
      await notifyActiveTabSettingsChanged();
      showStatus(shouldLock ? 'This site will open locked.' : 'Always-lock turned off.');
    } catch {
      siteLockOnLoad.checked = !shouldLock;
      showStatus('Could not update this site.');
    } finally {
      updateSiteLockOnLoadControl();
    }
  }

  async function toggleCurrentSiteExclusion() {
    if (!activeOrigin) return;
    const shouldExclude = !currentSettings?.excluded;
    toggleSiteExclusion.disabled = true;
    try {
      currentSettings = await window.BlurMyScreenSettings.setSiteExcluded(activeOrigin, shouldExclude);
      await notifyActiveTabSettingsChanged();
      updateSiteExclusionControl();
      updateSiteLockOnLoadControl();
      updateSitePiiControl();
      showStatus(shouldExclude ? 'Site excluded.' : 'Site included again.');
    } catch {
      showStatus('Could not update this site.');
    } finally {
      updateSiteExclusionControl();
    }
  }

  function updateSitePiiControl() {
    if (!activeOrigin) {
      sitePii.disabled = true;
      sitePii.checked = false;
      sitePiiLabel.textContent = 'Mask PII on this site';
      sitePiiHelp.textContent = 'This page does not have a supported web origin.';
      return;
    }

    const siteName = new URL(activeOrigin).host;
    if (currentSettings?.excluded) {
      sitePii.disabled = true;
      sitePii.checked = false;
      sitePiiLabel.textContent = `Mask PII on ${siteName}`;
      sitePiiHelp.textContent = 'This website is excluded from BlurMyScreen.';
      return;
    }
    const isExcluded = currentSettings?.siteRule?.overrides?.targetedMaskingEnabled === false;
    sitePii.disabled = false;
    sitePii.checked = !isExcluded;
    sitePiiLabel.textContent = `Mask PII on ${siteName}`;
    sitePiiHelp.textContent = currentSettings?.targetedMaskingEnabled === false
      ? 'Targeted PII masking is currently off globally.'
      : 'This preference is stored locally for this origin only.';
  }

  async function saveSitePiiPreference() {
    if (!activeOrigin) return;
    const shouldMask = sitePii.checked;
    sitePii.disabled = true;
    saveQueue = saveQueue.catch(() => undefined).then(() => window.BlurMyScreenSettings.setPiiMaskingForOrigin(activeOrigin, shouldMask));
    try {
      currentSettings = await saveQueue;
      updateSitePiiControl();
      showStatus(shouldMask ? 'PII masking enabled for this site.' : 'PII masking disabled for this site.');
    } catch {
      sitePii.checked = !shouldMask;
      showStatus('Could not update this site preference.');
    } finally {
      updateSitePiiControl();
    }
  }

  function scheduleSliderSave() {
    window.clearTimeout(sliderSaveTimer);
    sliderSaveTimer = window.setTimeout(() => {
      sliderSaveTimer = undefined;
      saveSettings();
    }, 200);
  }

  function flushSliderSave() {
    if (sliderSaveTimer === undefined) return;
    window.clearTimeout(sliderSaveTimer);
    sliderSaveTimer = undefined;
    saveSettings();
  }

  function updatePreview() {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'frosted';
    const val = Number(intensity.value);
    const brightnessPercent = Number(brightness.value);

    let backdropStyle = '';
    let bgColor = '';
    let borderColor = 'var(--border-sage)';
    let labelText = 'Blur Intensity';
    let valueText = `${val}px`;

    if (mode === 'frosted') {
      labelText = 'Blur Intensity';
      valueText = `${val}px`;
      const veilOpacity = Math.min(.84, .12 + (1 - brightnessPercent / 100) * 1.2);
      backdropStyle = `blur(${val}px) saturate(0.8) brightness(${brightnessPercent / 100})`;
      bgColor = `rgba(35, 52, 42, ${veilOpacity})`;
    } else if (mode === 'dimmed') {
      labelText = 'Veil Opacity';
      valueText = 'Dark veil';
      backdropStyle = 'none';
      bgColor = 'rgba(15, 25, 20, .74)';
      borderColor = 'rgba(15, 25, 20, .85)';
    } else if (mode === 'minimal') {
      labelText = 'Ceramic Tone';
      const hue = 80 + (val / 40) * 60; // 80 to 140 (greens/beiges)
      valueText = `Tone ${val}`;
      backdropStyle = 'none';
      bgColor = `hsl(${hue}, 25%, 95%)`;
      borderColor = `hsl(${hue}, 25%, 80%)`;
    }

    intensityLabel.textContent = labelText;
    intensityValue.textContent = valueText;
    brightnessValue.textContent = `${brightnessPercent}%`;
    brightnessControl.hidden = mode !== 'frosted';

    previewCard.style.backdropFilter = backdropStyle;
    previewCard.style.webkitBackdropFilter = backdropStyle;
    previewCard.style.backgroundColor = bgColor;
    previewCard.style.borderColor = borderColor;
  }

  async function lockCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const result = await chrome.runtime.sendMessage({ type: MESSAGES.LOCK, tabId: tab.id }).catch(() => ({ ok: false }));
    showStatus(result?.ok ? 'Tab locked successfully.' : 'This page cannot be locked.');
  }

  async function setPresentationMode() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const result = await chrome.runtime.sendMessage({ type: MESSAGES.SET_PRESENTATION, tabId: tab.id, enabled: presentation.checked }).catch(() => ({ ok: false }));
    if (!result?.ok) { presentation.checked = !presentation.checked; showStatus('This page cannot use presentation mode.'); }
    else { currentSettings = await window.BlurMyScreenSettings.get(activeOrigin, presentation.checked); showStatus(presentation.checked ? 'Presentation mode enabled for this tab.' : 'Presentation mode disabled.'); }
  }

  function showStatus(message) {
    status.textContent = message;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }

  async function initialize() {
    const [tabs, envelope] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), window.BlurMyScreenSettings.getEnvelope()]);
    activeOrigin = window.BlurMyScreenSettings.normalizeOrigin(tabs[0]?.url);
    const tabId = tabs[0]?.id;
    const tabState = tabId ? await chrome.tabs.sendMessage(tabId, { type: MESSAGES.STATUS }).catch(() => null) : null;
    presentation.checked = Boolean(tabState?.presentation);
    currentSettings = window.BlurMyScreenSettings.resolve(envelope, activeOrigin, presentation.checked);
    profile.replaceChildren(...envelope.profiles.map((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; option.selected = item.id === envelope.activeProfileId; return option; }));

    enabled.checked = currentSettings.enabled;
    updateMasterLabel();

    syncTimeoutControls(currentSettings.idleTimeoutSeconds);

    const modeRadio = document.querySelector(`input[name="mode"][value="${currentSettings.cloakMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    intensity.value = String(currentSettings.blurIntensityPx);
    brightness.value = String(currentSettings.brightnessPercent);
    pauseMedia.checked = currentSettings.pauseWhenMediaPlaying;
    cloakFocus.checked = currentSettings.cloakOnFocusLoss;
    maskPii.checked = currentSettings.targetedMaskingEnabled;
    hideHud.checked = currentSettings.hideHUD;
    piiSensitivity.value = currentSettings.pii?.sensitivity || 'balanced';
    updateSitePiiControl();
    updateSiteExclusionControl();
    updateSiteLockOnLoadControl();

    updatePreview();
    updateCountdown();
  }

  // Events
  enabled.addEventListener('change', saveSettings);
  document.querySelectorAll('input[name="timeout"]').forEach((radio) => radio.addEventListener('change', () => {
    customTimeout.value = '';
    saveSettings();
  }));
  customTimeout.addEventListener('input', () => {
    document.querySelectorAll('input[name="timeout"]').forEach((radio) => { radio.checked = false; });
  });
  customTimeout.addEventListener('change', () => {
    const value = Number(customTimeout.value);
    if (!Number.isFinite(value) || value < 5 || value > 3600) {
      customTimeout.setCustomValidity('Enter a value from 5 to 3600 seconds.');
      customTimeout.reportValidity();
      return;
    }
    customTimeout.setCustomValidity('');
    customTimeout.value = String(Math.round(value));
    const customSummary = document.querySelector('.custom-timeout summary');
    if (customSummary) customSummary.textContent = `Custom: ${customTimeout.value}s`;
    saveSettings();
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', () => {
    updatePreview();
    saveSettings();
  }));
  intensity.addEventListener('input', () => {
    updatePreview();
    scheduleSliderSave();
  });
  intensity.addEventListener('change', flushSliderSave);
  brightness.addEventListener('input', () => {
    updatePreview();
    scheduleSliderSave();
  });
  brightness.addEventListener('change', flushSliderSave);
  pauseMedia.addEventListener('change', saveSettings);
  cloakFocus.addEventListener('change', saveSettings);
  maskPii.addEventListener('change', saveSettings);
  sitePii.addEventListener('change', saveSitePiiPreference);
  hideHud.addEventListener('change', saveSettings);
  piiSensitivity.addEventListener('change', saveSettings);
  presentation.addEventListener('change', setPresentationMode);
  profile.addEventListener('change', async () => { await window.BlurMyScreenSettings.setActiveProfile(profile.value); currentSettings = await window.BlurMyScreenSettings.get(activeOrigin, presentation.checked); showStatus('Default profile updated.'); });
  $('#manage-rules').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#lock-now').addEventListener('click', lockCurrentTab);
  toggleSiteExclusion.addEventListener('click', toggleCurrentSiteExclusion);
  siteLockOnLoad.addEventListener('change', saveSiteLockOnLoad);

  // Preview Peek interaction: hold to reveal with keyboard, mouse, and touch.
  function revealPreview() {
    previewCard.style.backdropFilter = 'none';
    previewCard.style.webkitBackdropFilter = 'none';
  }

  function hidePreview() {
    peekPointerId = undefined;
    peekKeyboardActive = false;
    updatePreview();
  }

  previewPeek.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    peekPointerId = event.pointerId;
    previewPeek.setPointerCapture?.(event.pointerId);
    revealPreview();
    event.preventDefault();
  });
  previewPeek.addEventListener('pointerup', (event) => {
    if (event.pointerId === peekPointerId) hidePreview();
  });
  previewPeek.addEventListener('pointercancel', hidePreview);
  previewPeek.addEventListener('lostpointercapture', hidePreview);
  previewPeek.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      peekKeyboardActive = true;
      revealPreview();
      event.preventDefault();
    }
  });
  previewPeek.addEventListener('keyup', (event) => {
    if (peekKeyboardActive && (event.key === ' ' || event.key === 'Enter')) {
      hidePreview();
      event.preventDefault();
    }
  });
  previewPeek.addEventListener('blur', hidePreview);
  window.addEventListener('blur', hidePreview);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hidePreview(); });

  initialize();
})();
