(() => {
  'use strict';
  const MASK_CLASS = 'blur-my-screen-pii-mask';
  const OWNED = 'data-blur-my-screen-mask';
  const SKIP_SELECTOR = `.${MASK_CLASS}, script, style, noscript, template, textarea, input, select, option, button, [contenteditable], [aria-hidden="true"], #__blur_my_screen_overlay__`;
  let enabled = false; let config; let observer; let intersectionObserver; let mutationTimer; let scheduled = false;
  const pendingRoots = new Set(); const masks = new Set();

  function visible(element) { const style = getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0; }
  function eligibleNode(node) { return node?.nodeType === Node.TEXT_NODE && node.parentElement && !node.parentElement.closest(SKIP_SELECTOR) && visible(node.parentElement); }
  function setRevealed(mask, revealed) { mask.classList.toggle('blur-my-screen-pii-revealed', revealed); mask.setAttribute('aria-hidden', revealed ? 'false' : 'true'); }
  function createMask(text, category) {
    const mask = document.createElement('span'); mask.className = MASK_CLASS; mask.setAttribute(OWNED, ''); mask.dataset.category = category; mask.textContent = text;
    mask.setAttribute('aria-label', `${category} masked. Hold Shift while hovering to reveal.`); mask.tabIndex = 0;
    mask.addEventListener('mouseenter', (event) => setRevealed(mask, event.shiftKey)); mask.addEventListener('mouseleave', () => setRevealed(mask, false));
    mask.addEventListener('focus', () => setRevealed(mask, true)); mask.addEventListener('blur', () => setRevealed(mask, false)); masks.add(mask); return mask;
  }
  function scanNode(node) {
    if (!enabled || !eligibleNode(node) || masks.size >= config.maxMasks) return;
    const matched = window.BlurMyScreenPiiMatcher.matchesFor(node.nodeValue || '', config);
    if (!matched.length) return;
    const fragment = document.createDocumentFragment(); let offset = 0;
    for (const match of matched) { if (match.index < offset || masks.size >= config.maxMasks) continue; fragment.append(document.createTextNode(node.nodeValue.slice(offset, match.index)), createMask(match.text, match.category)); offset = match.index + match.text.length; }
    fragment.append(document.createTextNode(node.nodeValue.slice(offset))); node.replaceWith(fragment);
  }
  function queueRoot(node) { if (!node) return; if (node.nodeType === Node.TEXT_NODE) pendingRoots.add(node); else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) pendingRoots.add(node); }
  function scanRoot(root) {
    if (!enabled || !root || masks.size >= config.maxMasks) return;
    if (root.nodeType === Node.TEXT_NODE) { scanNode(root); return; }
    if (root.nodeType === Node.ELEMENT_NODE && (root.matches(SKIP_SELECTOR) || (!visible(root) && config.scope !== 'document'))) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode()) && masks.size < config.maxMasks) scanNode(node);
  }
  function emitUpdate() {
    for (const mask of masks) if (!mask.isConnected || !mask.matches(`.${MASK_CLASS}`)) masks.delete(mask);
    window.dispatchEvent(new CustomEvent('blur-my-screen:pii-updated', { detail: { count: masks.size, categories: [...masks].reduce((all, mask) => ({ ...all, [mask.dataset.category]: (all[mask.dataset.category] || 0) + 1 }), {}), mutationGuardActive: Boolean(enabled && observer), capped: masks.size >= config.maxMasks } }));
  }
  function processQueue(deadline) {
    scheduled = false;
    while (pendingRoots.size && (deadline?.timeRemaining?.() > 1 || deadline?.didTimeout || !deadline)) { scanRoot(pendingRoots.values().next().value); pendingRoots.delete(pendingRoots.values().next().value); }
    emitUpdate();
    if (pendingRoots.size) schedule();
  }
  function schedule() { if (scheduled || !enabled) return; scheduled = true; const callback = (deadline) => processQueue(deadline); if (window.requestIdleCallback) window.requestIdleCallback(callback, { timeout: 250 }); else window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 8 }), 0); }
  function scanPage() { if (!enabled || !document.body) return masks.size; observe(); queueRoot(document.body); schedule(); return masks.size; }
  function onMutations(records) {
    if (!enabled) return;
    for (const record of records) {
      if (record.target?.parentElement?.closest?.(`[${OWNED}]`)) continue;
      if (record.type === 'characterData') queueRoot(record.target); else record.addedNodes.forEach(queueRoot);
    }
    window.clearTimeout(mutationTimer); mutationTimer = window.setTimeout(schedule, config.mutationDebounceMs);
  }
  function observe() { if (enabled && document.body && observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  function unwrapMasks() { for (const mask of masks) if (mask.isConnected) mask.replaceWith(document.createTextNode(mask.textContent || '')); masks.clear(); }
  function applySettings(settings) {
    config = settings?.pii || {}; enabled = Boolean(settings?.targetedMaskingEnabled && window.BlurMyScreenSettings.normalizeOrigin(location.origin));
    window.clearTimeout(mutationTimer); pendingRoots.clear(); observer?.disconnect();
    if (!enabled) { unwrapMasks(); emitUpdate(); return; }
    if (!observer) observer = new MutationObserver(onMutations); observe(); scanPage();
  }
  function updateHoveredMasks(reveal) { document.querySelectorAll(`.${MASK_CLASS}:hover`).forEach((mask) => setRevealed(mask, reveal)); }
  async function initialize() { window.addEventListener('keydown', (event) => { if (event.key === 'Shift') updateHoveredMasks(true); }, true); window.addEventListener('keyup', (event) => { if (event.key === 'Shift') updateHoveredMasks(false); }, true); window.addEventListener('blur', () => updateHoveredMasks(false)); applySettings(await window.BlurMyScreenSettings.get(location.origin)); if (!document.body) document.addEventListener('DOMContentLoaded', scanPage, { once: true }); }
  window.BlurMyScreenPII = { initialize, applySettings, scanPage, getStatus: () => ({ count: masks.size, mutationGuardActive: Boolean(enabled && observer), capped: masks.size >= (config?.maxMasks || Infinity), categories: [...masks].reduce((all, mask) => ({ ...all, [mask.dataset.category]: (all[mask.dataset.category] || 0) + 1 }), {}) }) };
  initialize();
})();
