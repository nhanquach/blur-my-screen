(() => {
  'use strict';

  const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'touchmove'];
  const OVERLAY_ID = '__blur_my_screen_overlay__';

  let settings = {
    enabled: true,
    idleTimeoutSeconds: 180,
    cloakMode: 'frosted',
    blurIntensityPx: 20,
    pauseWhenMediaPlaying: true,
    cloakOnFocusLoss: true,
    targetedMaskingEnabled: true,
  };
  
  let inactivityTimer;
  let locked = false;
  let host;
  let startTime = Date.now();

  function getRemainingSeconds() {
    if (!settings.enabled || locked) return null;
    const elapsed = Date.now() - startTime;
    const remaining = (settings.idleTimeoutSeconds * 1000) - elapsed;
    return Math.max(0, Math.floor(remaining / 1000));
  }

  function isMediaPlaying() {
    return !!document.querySelector('video:not([paused]), audio:not([paused])');
  }

  function clearTimer() {
    window.clearTimeout(inactivityTimer);
  }

  function scheduleLock() {
    clearTimer();
    if (!settings.enabled || locked) return;

    if (settings.pauseWhenMediaPlaying && isMediaPlaying()) {
      inactivityTimer = window.setTimeout(scheduleLock, 5000);
      return;
    }

    startTime = Date.now();
    inactivityTimer = window.setTimeout(() => lock('idle'), settings.idleTimeoutSeconds * 1000);
  }

  function recordActivity() {
    if (!locked) {
      scheduleLock();
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      lock('manual-esc');
    }

    if (event.code === 'Space' && locked) {
      event.preventDefault();
      peekReveal(true);
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleMarqueeMode();
    }
  }

  function handleKeyUp(event) {
    if (event.code === 'Space') {
      peekReveal(false);
    }
  }

  function peekReveal(show) {
    if (!host) return;
    const screen = host.shadowRoot?.querySelector('.screen');
    if (screen) {
      screen.style.opacity = show ? '0' : '1';
      screen.style.pointerEvents = show ? 'none' : 'auto';
    }
  }

  let marqueeOverlay = null;
  let isMarqueeMode = false;

  function toggleMarqueeMode() {
    if (isMarqueeMode) {
      disableMarquee();
    } else {
      enableMarquee();
    }
  }

  function enableMarquee() {
    if (!locked) return;
    isMarqueeMode = true;
    
    marqueeOverlay = document.createElement('div');
    marqueeOverlay.id = '__blur_my_screen_marquee__';
    marqueeOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483646; 
      cursor: crosshair; pointer-events: auto;
    `;
    
    marqueeOverlay.innerHTML = `
      <div class="m-pane top"></div>
      <div class="m-pane right"></div>
      <div class="m-pane bottom"></div>
      <div class="m-pane left"></div>
      <style>
        .m-pane { position: absolute; background: transparent; pointer-events: none; }
        .m-pane.top { top: 0; left: 0; right: 0; }
        .m-pane.right { top: 0; right: 0; bottom: 0; }
        .m-pane.bottom { bottom: 0; left: 0; right: 0; }
        .m-pane.left { top: 0; left: 0; bottom: 0; }
      </style>
    `;
    
    document.documentElement.append(marqueeOverlay);

    marqueeOverlay.addEventListener('mousedown', startMarquee);
    window.addEventListener('keydown', handleMarqueeKeys);
  }

  function startMarquee(event) {
    const startX = event.clientX;
    const startY = event.clientY;
    
    const onMouseMove = (e) => {
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(startX - e.clientX);
      const h = Math.abs(startY - e.clientY);
      
      const panes = marqueeOverlay.querySelectorAll('.m-pane');
      panes[0].style.height = `${y}px`; // top
      panes[1].style.width = `${window.innerWidth - (x + w)}px`; // right
      panes[2].style.top = `${y + h}px`; // bottom
      panes[3].style.width = `${x}px`; // left
      
      const screen = host?.shadowRoot?.querySelector('.screen');
      if (screen) {
        screen.style.clipPath = `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, ${x}px ${y}px, ${x}px 100%, 0% 100%)`;
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleMarqueeKeys(event) {
    if (event.key === 'Escape') disableMarquee();
  }

  function disableMarquee() {
    isMarqueeMode = false;
    marqueeOverlay?.remove();
    marqueeOverlay = null;
    window.removeEventListener('keydown', handleMarqueeKeys);
    
    const screen = host?.shadowRoot?.querySelector('.screen');
    if (screen) {
      screen.style.clipPath = '';
    }
  }

  function removeOverlay() {
    disableMarquee();
    host?.remove();
    host = undefined;
  }

  function unlock() {
    locked = false;
    removeOverlay();
    scheduleLock();
  }

  function renderOverlay() {
    removeOverlay();
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.setAttribute('aria-live', 'polite');
    const shadow = host.attachShadow({ mode: 'closed' });

    const backdropStyle = settings.cloakMode === 'frosted' 
      ? `blur(${settings.blurIntensityPx}px) saturate(0.8) brightness(0.9)`
      : settings.cloakMode === 'dimmed'
      ? `brightness(0.4) contrast(0.8)`
      : `blur(0px) brightness(1)`;

    const bgStyle = settings.cloakMode === 'minimal'
      ? '#fbf9f6' 
      : 'rgba(251, 249, 246, 0.6)';

    const style = `
      :host { all: initial; }
      .screen { 
        position: fixed; inset: 0; z-index: 2147483647; 
        display: grid; place-items: center; box-sizing: border-box; 
        padding: 24px; color: #3d5a49; font-family: 'Manrope', sans-serif; 
        background: ${bgStyle}; 
        backdrop-filter: ${backdropStyle}; 
        -webkit-backdrop-filter: ${backdropStyle}; 
        transition: opacity 240ms ease;
      }
      .screen::before { 
        content: ""; position: absolute; inset: 0; pointer-events: none; 
        background-image: radial-gradient(circle, #3d5a49 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.05;
      }
      .hud { 
        position: relative; width: min(100%, 320px); padding: 24px; 
        text-align: center; border: 1px solid rgba(61, 90, 73, 0.2); 
        border-radius: 16px; background: rgba(255, 255, 255, 0.8); 
        box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
      }
      .brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; }
      .logo { font-size: 24px; }
      h1 { margin: 0; font-size: 20px; font-weight: 700; color: #3d5a49; }
      .status-pill { 
        display: inline-flex; align-items: center; justify-content: center; gap: 4px; 
        padding: 4px 12px; background: #f5f3f0; border-radius: 20px; 
        font-size: 12px; font-weight: 600; color: #6b7c74; margin-bottom: 20px;
      }
      button { 
        width: 100%; min-height: 44px; border: 0; border-radius: 12px; 
        cursor: pointer; background: #3d5a49; color: white; 
        font-weight: 700; transition: transform 150ms ease;
      }
      button:active { transform: scale(0.95); }
      .secondary-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
      .secondary-actions button { background: #f5f3f0; color: #3d5a49; font-size: 12px; }
      @media (prefers-reduced-motion: reduce) { .screen, button { transition: none; } }
    `;

    shadow.innerHTML = `
      <style>${style}</style>
      <section class="screen" role="dialog" aria-modal="true" aria-labelledby="hud-title">
        <div class="hud">
          <div class="brand">
            <span class="logo">🌿</span>
            <h1 id="hud-title">BlurMyScreen</h1>
          </div>
          <div class="status-pill" id="hud-status">
            <span class="dot"></span> Protecting your privacy
          </div>
          <button id="unblur-btn">Unblur Screen</button>
          <div class="secondary-actions">
            <button id="tune-btn">Tune</button>
            <button id="lock-btn">Hard Lock</button>
          </div>
        </div>
      </section>
    `;

    const unblurBtn = shadow.querySelector('#unblur-btn');
    if (unblurBtn) unblurBtn.addEventListener('click', unlock);

    document.documentElement.append(host);
  }

  function lock(reason) {
    if (!settings.enabled || locked) return;
    locked = true;
    clearTimer();
    renderOverlay();
    console.log(`Cloaked due to: ${reason}`);
  }

  async function initialize() {
    settings = await window.BlurMyScreenSettings.get();
    scheduleLock();
  }

  IDLE_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleLock();
    } else if (settings.cloakOnFocusLoss) {
      lock('focus-loss');
    }
  });

  function applySettings(nextSettings) {
    settings = nextSettings;
    if (!settings.enabled) {
      unlock();
    } else if (locked) {
      renderOverlay();
    } else {
      scheduleLock();
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.blurMyScreenSettings) {
      window.BlurMyScreenSettings.get().then(applySettings);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'blur-my-screen:lock') {
      lock('manual');
      sendResponse({ locked: true });
    } else if (message?.type === 'blur-my-screen:reset') {
      recordActivity();
      sendResponse({ reset: true });
    } else if (message?.type === 'blur-my-screen:status') {
      sendResponse({ 
        locked, 
        enabled: settings.enabled, 
        remainingSeconds: getRemainingSeconds(),
        isMediaPlaying: isMediaPlaying(),
        maskedCount: window.BlurMyScreenPII?.scanPage() || 0
      });
    }
  });


  window.addEventListener('blur-my-screen:pii-updated', (e) => {
    const count = e.detail.count;
    const statusPill = host?.shadowRoot?.querySelector('#hud-status');
    if (statusPill) {
      statusPill.textContent = count > 0 
        ? `🔒 ${count} PII Fields Masked` 
        : 'Protecting your privacy';
    }
  });

  window.BlurMyScreen = { lock, unlock, applySettings };
  initialize();
})();
