(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const enabled = $('#enabled');
  const idleMinutes = $('#idle-minutes');
  const passwordRow = $('#password-row');
  const password = $('#password');
  const status = $('#status');

  function selectedMode() {
    return document.querySelector('input[name="unlock-mode"]:checked').value;
  }

  function showStatus(message) {
    status.textContent = message;
  }

  async function saveSettings() {
    const unlockMode = selectedMode();
    const current = await window.BlurMyPageSettings.get();
    const updates = { enabled: enabled.checked, idleMinutes: Number(idleMinutes.value), unlockMode };
    if (unlockMode === 'password' && password.value) {
      updates.passwordHash = await window.BlurMyPageSettings.hashPassword(password.value);
      password.value = '';
    } else if (unlockMode === 'password' && !current.passwordHash) {
      showStatus('Enter a password to enable password unlock.');
      return;
    }
    const saved = await window.BlurMyPageSettings.save(updates);
    if (saved.unlockMode !== 'password' || saved.passwordHash) showStatus('Saved for all open pages.');
  }

  function updateModeUI() {
    passwordRow.hidden = selectedMode() !== 'password';
  }

  async function lockCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'blur-my-page:lock' });
      showStatus('This tab is now blurred.');
    } catch {
      showStatus('This page cannot be blurred.');
    }
  }

  async function initialize() {
    const settings = await window.BlurMyPageSettings.get();
    enabled.checked = settings.enabled;
    idleMinutes.value = String(settings.idleMinutes);
    document.querySelector(`input[name="unlock-mode"][value="${settings.unlockMode}"]`).checked = true;
    updateModeUI();
  }

  enabled.addEventListener('change', saveSettings);
  idleMinutes.addEventListener('change', saveSettings);
  document.querySelectorAll('input[name="unlock-mode"]').forEach((radio) => radio.addEventListener('change', () => { updateModeUI(); saveSettings(); }));
  password.addEventListener('change', saveSettings);
  $('#lock-now').addEventListener('click', lockCurrentTab);
  initialize();
})();
