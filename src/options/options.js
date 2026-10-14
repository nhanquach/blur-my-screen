(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  let envelope;

  function removeButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  async function render() {
    envelope = await window.BlurMyScreenSettings.getEnvelope();
    $('#profile').replaceChildren(...envelope.profiles.map((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      option.selected = profile.id === envelope.activeProfileId;
      return option;
    }));
    $('#profile-description').textContent = 'Select the baseline profile used unless a site rule overrides it.';

    const excludedSites = $('#excluded-sites');
    excludedSites.replaceChildren(...envelope.excludedOrigins.map((origin) => {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = origin;
      item.append(text, removeButton('Include again', async () => {
        await window.BlurMyScreenSettings.setSiteExcluded(origin, false);
        $('#exclude-status').textContent = `${new URL(origin).host} is included again.`;
        render();
      }));
      return item;
    }));

    const lockOnLoadSites = $('#lock-on-load-sites');
    lockOnLoadSites.replaceChildren(...envelope.lockOnLoadOrigins.map((origin) => {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = origin;
      item.append(text, removeButton('Stop locking', async () => {
        await window.BlurMyScreenSettings.setSiteLockOnLoad(origin, false);
        $('#lock-on-load-status').textContent = `${new URL(origin).host} no longer opens locked.`;
        render();
      }));
      return item;
    }));

    const rules = $('#rules');
    rules.replaceChildren(...envelope.siteRules.map((rule) => {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${rule.origin} — ${rule.profileId || 'default profile'}, PII ${rule.overrides?.targetedMaskingEnabled === false ? 'off' : 'on'}`;
      item.append(text, removeButton('Remove', async () => {
        const next = await window.BlurMyScreenSettings.getEnvelope();
        next.siteRules = next.siteRules.filter((candidate) => candidate.origin !== rule.origin);
        await chrome.storage.local.set({ [window.BlurMyScreenSettings.STORAGE_KEY]: next });
        render();
      }));
      return item;
    }));
  }

  $('#profile').addEventListener('change', async (event) => {
    await window.BlurMyScreenSettings.setActiveProfile(event.target.value);
    render();
  });

  $('#exclude-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const origin = window.BlurMyScreenSettings.normalizeOrigin($('#excluded-origin').value);
    if (!origin) {
      $('#exclude-status').textContent = 'Enter a full http(s) website address.';
      return;
    }
    await window.BlurMyScreenSettings.setSiteExcluded(origin, true);
    $('#exclude-status').textContent = `${new URL(origin).host} is excluded.`;
    event.target.reset();
    render();
  });

  $('#lock-on-load-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const origin = window.BlurMyScreenSettings.normalizeOrigin($('#lock-on-load-origin').value);
    if (!origin) {
      $('#lock-on-load-status').textContent = 'Enter a full http(s) website address.';
      return;
    }
    await window.BlurMyScreenSettings.setSiteLockOnLoad(origin, true);
    $('#lock-on-load-status').textContent = `${new URL(origin).host} will open locked.`;
    event.target.reset();
    render();
  });

  $('#rule-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const origin = window.BlurMyScreenSettings.normalizeOrigin($('#origin').value);
    if (!origin) {
      $('#status').textContent = 'Enter a full http(s) origin.';
      return;
    }
    const next = await window.BlurMyScreenSettings.getEnvelope();
    const rule = { id: `origin:${origin}`, origin, ...($('#always-protect').checked ? { profileId: 'strict' } : {}), overrides: { targetedMaskingEnabled: $('#mask-pii').checked } };
    const index = next.siteRules.findIndex((item) => item.origin === origin);
    if (index >= 0) next.siteRules[index] = rule; else next.siteRules.push(rule);
    await chrome.storage.local.set({ [window.BlurMyScreenSettings.STORAGE_KEY]: next });
    $('#status').textContent = 'Site rule saved locally.';
    event.target.reset();
    render();
  });

  render();
})();
