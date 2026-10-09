(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const enabled = $('#enabled');
  const statusLabelText = $('.label-text');
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
  const hideHud = $('#hide-hud');
  const status = $('#status');

  const MESSAGES = window.BlurMyScreenMessages;
  let countdownInterval;
  let sliderSaveTimer;
  let saveQueue = Promise.resolve();

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
        const details = [response.locked ? 'Cloaked' : 'Protecting', response.isMediaPlaying ? 'media playing' : null, response.count ? `${response.count} PII masked` : null].filter(Boolean);
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
    };

    saveQueue = saveQueue.catch(() => undefined).then(() => window.BlurMyScreenSettings.save(updates));
    return saveQueue.then(updateMasterLabel);
  }

  function updateMasterLabel() {
    statusLabelText.textContent = enabled.checked ? 'Protecting' : 'Off';
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
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MESSAGES.LOCK });
      showStatus('Tab locked successfully.');
    } catch {
      showStatus('This page cannot be locked.');
    }
  }

  function showStatus(message) {
    status.textContent = message;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }

  async function initialize() {
    const settings = await window.BlurMyScreenSettings.get();

    enabled.checked = settings.enabled;
    updateMasterLabel();

    syncTimeoutControls(settings.idleTimeoutSeconds);

    const modeRadio = document.querySelector(`input[name="mode"][value="${settings.cloakMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    intensity.value = String(settings.blurIntensityPx);
    brightness.value = String(settings.brightnessPercent);
    pauseMedia.checked = settings.pauseWhenMediaPlaying;
    cloakFocus.checked = settings.cloakOnFocusLoss;
    maskPii.checked = settings.targetedMaskingEnabled;
    hideHud.checked = settings.hideHUD;
    
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
  hideHud.addEventListener('change', saveSettings);
  $('#lock-now').addEventListener('click', lockCurrentTab);

  // Preview Peek interaction: hold to reveal
  previewPeek.addEventListener('mousedown', () => {
    previewCard.style.backdropFilter = 'none';
    previewCard.style.webkitBackdropFilter = 'none';
  });
  previewPeek.addEventListener('mouseup', updatePreview);
  previewPeek.addEventListener('mouseleave', updatePreview);

  initialize();
})();
