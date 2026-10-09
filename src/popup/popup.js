(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const enabled = $('#enabled');
  const statusLabelText = $('.label-text');
  const countdown = $('#countdown');
  const intensity = $('#intensity');
  const intensityValue = $('#intensity-value');
  const previewCard = $('#preview-card');
  const previewPeek = $('#preview-peek');
  const pauseMedia = $('#pause-media');
  const cloakFocus = $('#cloak-focus');
  const maskPii = $('#mask-pii');
  const status = $('#status');

  let countdownInterval;

  function updateCountdown() {
    clearInterval(countdownInterval);
    
    const update = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'blur-my-screen:status' });
        if (response) {
          if (response.remainingSeconds !== undefined) {
            const s = response.remainingSeconds;
            const m = Math.floor(s / 60);
            const sec = s % 60;
            countdown.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
          } else {
            countdown.textContent = '--';
          }
          
          // If masked count is provided, we could show it in the popup status
          if (response.maskedCount !== undefined && response.maskedCount > 0) {
            showStatus(`🔒 ${response.maskedCount} PII fields masked on this page`);
          }
        } else {
          countdown.textContent = '--';
        }
      } catch (e) {
        countdown.textContent = '--';
      }
    };


    update();
    countdownInterval = setInterval(update, 1000);
  }

  async function saveSettings() {
    const timeoutValue = document.querySelector('input[name="timeout"]:checked')?.value;
    const modeValue = document.querySelector('input[name="mode"]:checked')?.value;
    
    const updates = {
      enabled: enabled.checked,
      idleTimeoutSeconds: timeoutValue ? Number(timeoutValue) : undefined,
      cloakMode: modeValue || undefined,
      blurIntensityPx: Number(intensity.value),
      pauseWhenMediaPlaying: pauseMedia.checked,
      cloakOnFocusLoss: cloakFocus.checked,
      targetedMaskingEnabled: maskPii.checked,
    };

    await window.BlurMyScreenSettings.save(updates);
    updateMasterLabel();
  }

  function updateMasterLabel() {
    statusLabelText.textContent = enabled.checked ? 'Protecting' : 'Paused';
  }

  function updatePreview() {
    intensityValue.textContent = `${intensity.value}px`;
    previewCard.style.backdropFilter = `blur(${intensity.value}px)`;
    previewCard.style.webkitBackdropFilter = `blur(${intensity.value}px)`;
  }

  async function lockCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'blur-my-screen:lock' });
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

    document.querySelector(`input[name="timeout"][value="${settings.idleTimeoutSeconds}"]`)?.checked = true;
    document.querySelector(`input[name="mode"][value="${settings.cloakMode}"]`)?.checked = true;
    intensity.value = String(settings.blurIntensityPx);
    pauseMedia.checked = settings.pauseWhenMediaPlaying;
    cloakFocus.checked = settings.cloakOnFocusLoss;
    maskPii.checked = settings.targetedMaskingEnabled;
    
    updatePreview();
    updateCountdown();
  }

  // Events
  enabled.addEventListener('change', saveSettings);
  document.querySelectorAll('input[name="timeout"]').forEach(r => r.addEventListener('change', saveSettings));
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', saveSettings));
  intensity.addEventListener('input', () => {
    updatePreview();
    saveSettings();
  });
  pauseMedia.addEventListener('change', saveSettings);
  cloakFocus.addEventListener('change', saveSettings);
  maskPii.addEventListener('change', saveSettings);
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
