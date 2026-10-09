(() => {
  'use strict';

  const MASK_CLASS = 'blur-my-screen-pii-mask';
  const SKIP_SELECTOR = `.${MASK_CLASS}, script, style, noscript, textarea, input, select, option, button, [contenteditable], #__blur_my_screen_overlay__`;
  const PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
    currency: /(?:\$|€|£|¥)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:\$|€|£|¥)/g,
    labeledName: /\b(?:Full Name|Name|Patient|Client):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
  };

  let enabled = false;
  let observer;
  let mutationTimer;
  let initialized = false;

  function isLuhnValid(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (shouldDouble && (digit *= 2) > 9) digit -= 9;
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function setRevealed(mask, revealed) {
    mask.classList.toggle('blur-my-screen-pii-revealed', revealed);
  }

  function createMask(text) {
    const mask = document.createElement('span');
    mask.className = MASK_CLASS;
    mask.textContent = text;
    mask.setAttribute('aria-label', 'Sensitive value masked. Hold Shift while hovering to reveal.');
    mask.style.cssText = 'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);background:rgba(245,243,240,.65);border-radius:4px;padding:0 2px;color:transparent;cursor:help;';
    mask.addEventListener('mouseenter', (event) => setRevealed(mask, event.shiftKey));
    mask.addEventListener('mouseleave', () => setRevealed(mask, false));
    return mask;
  }

  function matchesFor(text) {
    const matches = [];
    for (const match of text.matchAll(PATTERNS.email)) matches.push({ index: match.index, text: match[0] });
    for (const match of text.matchAll(PATTERNS.creditCard)) {
      if (isLuhnValid(match[0])) matches.push({ index: match.index, text: match[0] });
    }
    for (const match of text.matchAll(PATTERNS.currency)) matches.push({ index: match.index, text: match[0] });
    for (const match of text.matchAll(PATTERNS.labeledName)) {
      const name = match[1];
      matches.push({ index: match.index + match[0].lastIndexOf(name), text: name });
    }
    return matches.sort((a, b) => a.index - b.index);
  }

  function scanNode(node) {
    if (node.nodeType !== Node.TEXT_NODE || !node.parentElement || node.parentElement.closest(SKIP_SELECTOR)) return;
    const text = node.nodeValue || '';
    const matches = matchesFor(text);
    if (!matches.length) return;

    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      if (match.index < offset) continue;
      fragment.append(document.createTextNode(text.slice(offset, match.index)), createMask(match.text));
      offset = match.index + match.text.length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    node.replaceWith(fragment);
  }

  function countMasks() {
    return document.querySelectorAll(`.${MASK_CLASS}`).length;
  }

  function emitUpdate() {
    window.dispatchEvent(new CustomEvent('blur-my-screen:pii-updated', {
      detail: { count: countMasks(), mutationGuardActive: Boolean(observer) },
    }));
  }

  function scanPage() {
    if (!enabled || !document.body) return countMasks();
    observer?.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(scanNode);
    observe();
    emitUpdate();
    return countMasks();
  }

  function onMutations() {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(scanPage, 300);
  }

  function observe() {
    if (enabled && document.body && observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function unwrapMasks() {
    document.querySelectorAll(`.${MASK_CLASS}`).forEach((mask) => mask.replaceWith(document.createTextNode(mask.textContent || '')));
  }

  function applySettings(settings) {
    const nextEnabled = Boolean(settings?.targetedMaskingEnabled);
    if (!nextEnabled) {
      enabled = false;
      window.clearTimeout(mutationTimer);
      observer?.disconnect();
      unwrapMasks();
      emitUpdate();
      return;
    }
    enabled = true;
    if (!observer) observer = new MutationObserver(onMutations);
    if (document.body) scanPage();
  }

  function updateHoveredMasks(reveal) {
    document.querySelectorAll(`.${MASK_CLASS}:hover`).forEach((mask) => setRevealed(mask, reveal));
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    window.addEventListener('keydown', (event) => { if (event.key === 'Shift') updateHoveredMasks(true); }, true);
    window.addEventListener('keyup', (event) => { if (event.key === 'Shift') updateHoveredMasks(false); }, true);
    window.addEventListener('blur', () => updateHoveredMasks(false));
    const settings = await window.BlurMyScreenSettings.get();
    applySettings(settings);
    if (!document.body) document.addEventListener('DOMContentLoaded', () => scanPage(), { once: true });
  }

  window.BlurMyScreenPII = { initialize, applySettings, scanPage, getStatus: () => ({ count: countMasks(), mutationGuardActive: Boolean(observer && enabled) }) };
  initialize();
})();
