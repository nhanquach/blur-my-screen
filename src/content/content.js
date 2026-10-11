(() => {
  'use strict';

  const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'touchmove'];
  const OVERLAY_ID = '__blur_my_screen_overlay__';
  const OVERLAY_TRANSITION_MS = 360;
  const MESSAGES = window.BlurMyScreenMessages;
  let settings;
  let inactivityTimer;
  let locked = false;
  let lockKind = null; // "manual" survives navigation; automatic locks are document-lifetime only.
  let presentationMode = false;
  let host;
  const inactivity = window.BlurMyScreenInactivityTimer.create();
  let marquee;
  let marqueeMode = false;
  let pendingManualLock = false;

  function mediaPlaying() {
    return [...document.querySelectorAll('video, audio')].some((media) => !media.paused && !media.ended);
  }

  function remainingSeconds() {
    if (!settings?.enabled || locked || inactivity.isPaused()) return null;
    return Math.ceil(inactivity.remaining() / 1000);
  }

  function clearTimer() { window.clearTimeout(inactivityTimer); }

  function scheduleLock(reset = true) {
    clearTimer();
    if (!settings?.enabled) { inactivity.clear(); return; }
    if (locked) return;

    if (reset) inactivity.reset(settings.idleTimeoutSeconds * 1000);
    if (settings.pauseWhenMediaPlaying && mediaPlaying()) {
      inactivity.pause();
      return;
    }
    if (inactivity.isPaused()) inactivity.resume();
    if (!inactivity.hasDeadline()) inactivity.reset(settings.idleTimeoutSeconds * 1000);

    const remainingMs = inactivity.remaining();
    if (remainingMs <= 0) { lock('idle'); return; }
    inactivityTimer = window.setTimeout(() => lock('idle'), remainingMs);
  }

  function recordActivity() { if (!locked) scheduleLock(true); }

  function onMediaChange() {
    if (locked || !settings?.enabled || !settings.pauseWhenMediaPlaying) return;
    // Playback only pauses the current budget. It must never reset the timer.
    scheduleLock(false);
  }

  function addMediaListeners(root = document) {
    const mediaNodes = [];
    if (root.matches?.('video, audio')) mediaNodes.push(root);
    root.querySelectorAll?.('video, audio').forEach((media) => mediaNodes.push(media));
    mediaNodes.forEach((media) => {
      if (media.dataset.blurMyScreenObserved) return;
      media.dataset.blurMyScreenObserved = 'true';
      media.addEventListener('play', onMediaChange);
      media.addEventListener('pause', onMediaChange);
      media.addEventListener('ended', onMediaChange);
    });
  }

  function applyVeilStyle(screen) {
    const intensity = settings.blurIntensityPx;
    if (settings.cloakMode === 'frosted') {
      const brightness = settings.brightnessPercent / 100;
      // The veil itself must darken too; an opaque light veil would otherwise
      // wash out the page even when the backdrop brightness is lowered.
      const veilOpacity = Math.min(.84, .12 + (1 - brightness) * 1.2);
      screen.style.backdropFilter = `blur(${intensity}px) saturate(.8) brightness(${brightness})`;
      screen.style.webkitBackdropFilter = screen.style.backdropFilter;
      screen.style.background = `rgba(35,52,42,${veilOpacity})`;
    } else if (settings.cloakMode === 'dimmed') {
      screen.style.backdropFilter = 'none';
      screen.style.webkitBackdropFilter = 'none';
      screen.style.background = 'rgba(15, 25, 20, .74)';
    } else {
      screen.style.backdropFilter = 'none';
      screen.style.webkitBackdropFilter = 'none';
      screen.style.background = '#F4F5F0';
    }
  }

  function updateHudStatus() {
    const status = host?.shadowRoot?.querySelector('#hud-status');
    if (!status) return;
    const pii = window.BlurMyScreenPII?.getStatus();
    status.textContent = pii?.count ? `Protected · ${pii.count} PII fields masked${pii.capped ? ' (scan limit reached)' : ''}` : 'Protected locally';
  }

  function disableMarquee() {
    marqueeMode = false;
    marquee?.remove();
    marquee = undefined;
    const screen = host?.shadowRoot?.querySelector('.screen');
    if (screen) screen.style.visibility = '';
  }

  function enableMarquee() {
    if (!locked || marqueeMode) return;
    marqueeMode = true;
    const screen = host?.shadowRoot?.querySelector('.screen');
    if (screen) screen.style.visibility = 'hidden';
    marquee = document.createElement('div');
    marquee.id = '__blur_my_screen_marquee__';
    marquee.innerHTML = '<i></i><i></i><i></i><i></i>';
    marquee.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair';
    marquee.querySelectorAll('i').forEach((pane, index) => Object.assign(pane.style, { position: 'fixed', display: 'block', inset: '0', background: settings.cloakMode === 'minimal' ? '#F4F5F0' : settings.cloakMode === 'dimmed' ? 'rgba(15,25,20,.74)' : `rgba(35,52,42,${Math.min(.84, .12 + (1 - settings.brightnessPercent / 100) * 1.2)})`, backdropFilter: settings.cloakMode === 'frosted' ? `blur(${settings.blurIntensityPx}px) saturate(.8) brightness(${settings.brightnessPercent / 100})` : 'none', WebkitBackdropFilter: settings.cloakMode === 'frosted' ? `blur(${settings.blurIntensityPx}px) saturate(.8) brightness(${settings.brightnessPercent / 100})` : 'none', ...(index ? { visibility: 'hidden' } : {}) }));
    document.documentElement.append(marquee);
    marquee.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const panes = [...marquee.querySelectorAll('i')];
      panes.forEach((pane) => { pane.style.visibility = 'visible'; pane.style.inset = 'auto'; });
      const start = { x: event.clientX, y: event.clientY };
      const update = (move) => {
        const x = Math.min(start.x, move.clientX); const y = Math.min(start.y, move.clientY);
        const width = Math.abs(start.x - move.clientX); const height = Math.abs(start.y - move.clientY);
        const [top, right, bottom, left] = marquee.querySelectorAll('i');
        Object.assign(top.style, { left: '0', top: '0', right: '0', height: `${y}px` });
        Object.assign(right.style, { left: `${x + width}px`, top: `${y}px`, right: '0', bottom: '0' });
        Object.assign(bottom.style, { left: `${x}px`, top: `${y + height}px`, right: '0', bottom: '0' });
        Object.assign(left.style, { left: '0', top: `${y}px`, width: `${x}px`, height: `${height}px` });
      };
      const finish = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', finish); };
      window.addEventListener('pointermove', update); window.addEventListener('pointerup', finish, { once: true });
      update(event);
    });
  }

  function renderOverlay() {
    host?.remove();
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      .screen{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;padding:20px;box-sizing:border-box;color:#263c32;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;opacity:0;transition:opacity 360ms cubic-bezier(.22,.61,.36,1);will-change:opacity}.screen.is-visible{opacity:1}.screen.is-peeking{opacity:0;transition-duration:180ms}.screen:before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,#3d5a49 1px,transparent 1px);background-size:40px 40px;opacity:.05}.hud{position:relative;display:flex;align-items:center;width:min(372px,100%);height:46px;padding:0 7px;border:1px solid #e4e9e5;border-radius:15px;background:#fff;box-shadow:0 12px 30px rgba(31,53,42,.16),0 2px 6px rgba(31,53,42,.06);opacity:0;transform:translateY(10px) scale(.985);transition:opacity 260ms ease-out 70ms,transform 360ms cubic-bezier(.22,.61,.36,1) 70ms;will-change:transform,opacity}.screen.is-visible .hud{opacity:1;transform:translateY(0) scale(1)}.screen.is-peeking .hud{transition-delay:0ms}.identity{display:flex;align-items:center;gap:7px;min-width:0;padding:0 7px 0 1px}.shield{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#e7f4eb;color:#477663}.shield svg,.action svg,.unblur svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.brand{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:750;letter-spacing:-.01em}.state{display:block;width:5px;height:5px;margin-left:1px;border-radius:50%;background:#4b8069;box-shadow:0 0 0 2px #e6f4ec}.status{display:none}.unblur{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;margin-left:auto;padding:0 9px;border:0;border-radius:8px;background:#3d6654;color:#fff;font:700 12px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.16)}.unlock-fallback{position:relative;margin-left:0;padding:0 16px;box-shadow:0 8px 20px rgba(31,53,42,.2)}.hud[hidden],.unlock-fallback[hidden]{display:none!important}.unblur svg{color:#fff;stroke:#fff!important;flex:0 0 16px}.unblur:hover{background:#315644}.key{padding:2px 4px;border-radius:3px;background:rgba(255,255,255,.17);font:600 9px/1 ui-monospace,SFMono-Regular,monospace;color:#fff}.separator{width:1px;height:22px;margin:0 2px 0 7px;background:#e7ece8}.action{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;color:#486052;cursor:pointer}.action:hover,.action:focus-visible{background:#edf3ef;outline:none}.action:focus-visible,.unblur:focus-visible{outline:2px solid #264d3c;outline-offset:2px}@media(max-width:430px){.screen{padding:12px}.hud{width:100%;height:44px}.identity{padding-right:3px}.brand{font-size:0}.state{margin-left:0}.unblur{gap:5px;padding:0 8px}.key{display:none}.separator{margin:0 1px 0 5px}.action{width:28px;height:28px}}@media(prefers-reduced-motion:reduce){.screen,.hud{transition:none!important}.screen{will-change:auto}.hud{will-change:auto}}</style>
      <section class="screen" role="dialog" aria-modal="true" aria-labelledby="hud-title" tabindex="-1"><div class="hud"><div class="identity"><span class="shield" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5.5 6v5.2c0 4.4 2.7 7.5 6.5 9.3 3.8-1.8 6.5-4.9 6.5-9.3V6L12 3Z"/></svg></span><span class="brand" id="hud-title">BlurMyScreen</span><span class="state" aria-label="Protection active"></span></div><p class="status" id="hud-status"></p><button class="unblur" id="unblur" type="button" aria-label="Unblur screen; hold Space for a temporary peek"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.25"/></svg><span>Unblur</span><kbd class="key">Space</kbd></button><span class="separator" aria-hidden="true"></span><button class="action" id="tune" type="button" aria-label="Cycle cloak appearance"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg></button><button class="action" id="lock" type="button" aria-label="Lock screen"><svg viewBox="0 0 24 24"><rect x="5.5" y="10" width="13" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg></button></div><button class="unblur unlock-fallback" id="unblur-fallback" type="button" aria-label="Unblur screen">Unblur screen</button></section>`;
    const screen = shadow.querySelector('.screen');
    applyVeilStyle(screen);
    shadow.querySelector('#unblur').addEventListener('click', unlock);
    shadow.querySelector('#unblur-fallback').addEventListener('click', unlock);
    shadow.querySelector('#lock').addEventListener('click', () => lock('manual'));
    shadow.querySelector('#tune').addEventListener('click', async () => {
      const modes = ['frosted', 'dimmed', 'minimal'];
      settings = await window.BlurMyScreenSettings.save({ cloakMode: modes[(modes.indexOf(settings.cloakMode) + 1) % modes.length] });
      applyVeilStyle(screen);
    });
    document.documentElement.append(host);
    const hud = shadow.querySelector('.hud');
    const fallbackUnlock = shadow.querySelector('#unblur-fallback');
    // Keep exactly one affordance in the DOM. Relying on `hidden` here is
    // fragile because page/author display rules can override it in a shadow UI.
    if (settings.hideHUD) hud.remove();
    else fallbackUnlock.remove();
    updateHudStatus();
    requestAnimationFrame(() => {
      screen.classList.add('is-visible');
      (settings.hideHUD ? fallbackUnlock : shadow.querySelector('#unblur')).focus({ preventScroll: true });
    });
  }

  function lock(reason) {
    const manual = ['manual', 'restored-manual', 'popup'].includes(reason);
    if (!settings) { if (manual) pendingManualLock = true; return; }
    if (settings.excluded) { pendingManualLock = false; return; }
    if (!settings.enabled && !manual) return;
    // Playback is an active-use signal. Never let any automatic trigger
    // (including browser idle and focus events) cloak a playing tab.
    if (!manual && settings.pauseWhenMediaPlaying && mediaPlaying()) {
      scheduleLock(false);
      return;
    }
    if (locked) {
      disableMarquee();
      // Esc/HUD/manual lock upgrades an automatic cloak into a persistent one.
      if (manual && lockKind !== 'manual') {
        lockKind = 'manual';
        chrome.runtime.sendMessage({ type: MESSAGES.LOCK_STATE, manualLocked: true }).catch(() => undefined);
      }
      if (manual) renderOverlay();
      return;
    }
    locked = true;
    lockKind = manual ? 'manual' : 'automatic';
    clearTimer();
    inactivity.clear();
    if (manual) chrome.runtime.sendMessage({ type: MESSAGES.LOCK_STATE, manualLocked: true }).catch(() => undefined);
    renderOverlay();
  }

  function unlock() {
    locked = false;
    lockKind = null;
    pendingManualLock = false;
    chrome.runtime.sendMessage({ type: MESSAGES.LOCK_STATE, manualLocked: false }).catch(() => undefined);
    disableMarquee();
    const currentHost = host;
    const screen = currentHost?.shadowRoot?.querySelector('.screen');
    if (screen) {
      screen.classList.remove('is-visible');
      screen.classList.remove('is-peeking');
      setTimeout(() => {
        if (host === currentHost) {
          host?.remove();
          host = undefined;
        }
      }, OVERLAY_TRANSITION_MS);
    } else {
      host?.remove();
      host = undefined;
    }
    scheduleLock(true);
  }

  function onKeyDown(event) {
    const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm';
    const peek = event.code === 'Space' && locked;
    // Preserve Escape for the page. It only exits our temporary marquee mode.
    if (event.key === 'Escape') {
      if (marqueeMode) { event.preventDefault(); event.stopImmediatePropagation(); disableMarquee(); }
      return;
    }
    if (shortcut) { event.preventDefault(); event.stopImmediatePropagation(); marqueeMode ? disableMarquee() : enableMarquee(); return; }
    if (peek && !event.repeat) {
      event.preventDefault(); event.stopImmediatePropagation();
      host?.shadowRoot?.querySelector('.screen')?.classList.add('is-peeking');
      return;
    }
    if (!locked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'Tab') {
      const controls = [...(host?.shadowRoot?.querySelectorAll('.hud:not([hidden]) button:not([hidden]), .unlock-fallback:not([hidden])') || [])];
      if (!controls.length) { host?.shadowRoot?.querySelector('.screen')?.focus(); return; }
      const first = controls[0]; const last = controls.at(-1);
      const active = host?.shadowRoot?.activeElement;
      if (event.shiftKey && (active === first || !controls.includes(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !controls.includes(active))) { event.preventDefault(); first.focus(); }
    }
  }

  function onKeyUp(event) {
    if (event.code === 'Space') {
      if (locked) { event.preventDefault(); event.stopImmediatePropagation(); }
      host?.shadowRoot?.querySelector('.screen')?.classList.remove('is-peeking');
    }
  }

  function applySettings(next) {
    settings = next;
    window.BlurMyScreenPII?.applySettings(settings);
    addMediaListeners();
    // The master protection switch is an explicit opt-out: clear every cloak,
    // including a persisted manual lock, so the visible page matches the popup.
    if ((!settings.enabled || settings.excluded) && locked) unlock();
    if (settings.excluded) pendingManualLock = false;
    else if (locked) renderOverlay();
    else scheduleLock(true);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGES.LOCK) {
      if (!settings) pendingManualLock = true;
      else lock('manual');
      sendResponse({ locked: locked || pendingManualLock, kind: 'manual' });
    }
    else if (message?.type === MESSAGES.AUTO_LOCK) {
      // A system-idle signal is an independent privacy trigger; it should not
      // wait for the page-local inactivity deadline to expire.
      if (settings?.enabled) lock('system-idle');
      sendResponse({ locked });
    }
    else if (message?.type === MESSAGES.FOCUS_LOSS) { if (settings?.cloakOnFocusLoss) lock('focus-loss'); sendResponse({ locked }); }
    else if (message?.type === MESSAGES.RESET) { recordActivity(); sendResponse({ reset: true }); }
    else if (message?.type === MESSAGES.SET_PRESENTATION) {
      presentationMode = Boolean(message.enabled);
      window.BlurMyScreenSettings.get(location.origin, presentationMode).then(applySettings);
      sendResponse({ presentation: presentationMode });
    }
    else if (message?.type === MESSAGES.SETTINGS_CHANGED) {
      window.BlurMyScreenSettings.get(location.origin, presentationMode).then((next) => { applySettings(next); sendResponse({ applied: true }); });
      return true;
    }
    else if (message?.type === MESSAGES.STATUS) sendResponse({ locked, lockKind, enabled: settings?.enabled, excluded: settings?.excluded === true, profileName: settings?.profileName, presentation: presentationMode, remainingSeconds: remainingSeconds(), isMediaPlaying: mediaPlaying(), appearance: { cloakMode: settings?.cloakMode, blurIntensityPx: settings?.blurIntensityPx, brightnessPercent: settings?.brightnessPercent }, ...window.BlurMyScreenPII?.getStatus() });
  });

  async function initialize() {
    const savedState = await chrome.runtime.sendMessage({ type: MESSAGES.GET_LOCK_STATE }).catch(() => ({ manualLocked: false, presentation: false }));
    presentationMode = savedState?.presentation === true;
    settings = await window.BlurMyScreenSettings.get(location.origin, presentationMode);
    addMediaListeners();
    // `play`/`pause` do not bubble, so capture them at the document level as
    // well as observing known media. This covers dynamically mounted players.
    ['play', 'pause', 'ended'].forEach((name) => document.addEventListener(name, onMediaChange, true));
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) addMediaListeners(node); }))).observe(document.documentElement, { childList: true, subtree: true });
    if (savedState?.manualLocked || pendingManualLock) lock(savedState?.manualLocked ? 'restored-manual' : 'manual');
    else scheduleLock(true);
  }

  IDLE_EVENTS.forEach((name) => window.addEventListener(name, recordActivity, { capture: true, passive: true }));
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('focusin', (event) => {
    if (locked && host && event.target !== host && !host.contains(event.target)) {
      const hud = host.shadowRoot?.querySelector('.hud');
      (hud && !hud.hidden ? hud.querySelector('#unblur') : host.shadowRoot?.querySelector('#unblur-fallback'))?.focus({ preventScroll: true });
    }
  }, true);
  window.addEventListener('blur', () => { if (locked) onKeyUp({ code: 'Space' }); });
  window.addEventListener('beforeunload', disableMarquee);
  document.addEventListener('visibilitychange', () => document.hidden && settings?.cloakOnFocusLoss && lock('focus-loss'));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.blurMyScreenSettings) window.BlurMyScreenSettings.get(location.origin, presentationMode).then(applySettings); });
  window.addEventListener('blur-my-screen:pii-updated', updateHudStatus);
  window.BlurMyScreen = { lock, unlock, applySettings };
  initialize();
})();
