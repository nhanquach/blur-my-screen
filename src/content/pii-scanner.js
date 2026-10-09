(() => {
  'use strict';

  const MASK_CLASS = 'blur-my-screen-pii-mask';
  const PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
    currency: /(?:\$|€|£|¥)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:\$|€|£|¥)/g,
    // Labeled names: Look for "Name: [Value]" or similar patterns
    labeledName: /(?:Name|Full Name|Patient|Client):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  };

  function isLuhnValid(number) {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      if (shouldDouble) {
        if ((digit *= 2) > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function createMask(text) {
    const span = document.createElement('span');
    span.className = MASK_CLASS;
    span.textContent = text;
    span.style.cssText = `
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      background: rgba(245, 243, 240, 0.4);
      border-radius: 4px;
      padding: 0 2px;
      color: transparent;
      transition: all 0.2s ease;
      cursor: help;
    `;

    // Shift + Hover reveal
    span.addEventListener('mouseenter', (e) => {
      if (e.shiftKey) {
        span.style.color = 'inherit';
        span.style.backdropFilter = 'none';
        span.style.webkitBackdropFilter = 'none';
        span.style.background = 'transparent';
      }
    });
    span.addEventListener('mouseleave', () => {
      span.style.color = 'transparent';
      span.style.backdropFilter = 'blur(6px)';
      span.style.webkitBackdropFilter = 'blur(6px)';
      span.style.background = 'rgba(245, 243, 240, 0.4)';
    });
    span.addEventListener('mouseover', (e) => {
      if (e.shiftKey) {
        span.style.color = 'inherit';
        span.style.backdropFilter = 'none';
        span.style.webkitBackdropFilter = 'none';
        span.style.background = 'transparent';
      }
    });

    return span;
  }

  function scanNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return 0;
    if (node.parentElement?.closest(`.${MASK_CLASS}, script, style, textarea, input`)) return 0;

    const text = node.textContent;
    let maskedCount = 0;
    let matchFound = false;
    let resultHtml = '';
    let lastIndex = 0;

    // We'll simplify by only masking one type per node to avoid overlap complexity, 
    // or use a combined approach.
    const allMatches = [];

    // Emails
    for (const match of text.matchAll(PATTERNS.email)) {
      allMatches.push({ index: match.index, text: match[0], type: 'email' });
    }
    // Cards
    for (const match of text.matchAll(PATTERNS.creditCard)) {
      if (isLuhnValid(match[0])) {
        allMatches.push({ index: match.index, text: match[0], type: 'card' });
      }
    }
    // Currency
    for (const match of text.matchAll(PATTERNS.currency)) {
      allMatches.push({ index: match.index, text: match[0], type: 'currency' });
    }
    // Labeled Names
    for (const match of text.matchAll(PATTERNS.labeledName)) {
      // Match group 1 is the actual name
      allMatches.push({ index: match.index, text: match[0], type: 'name' });
    }

    if (allMatches.length === 0) return 0;

    // Sort matches by index
    allMatches.sort((a, b) => a.index - b.index);

    const fragment = document.createDocumentFragment();
    let currentPos = 0;

    for (const match of allMatches) {
      if (match.index < currentPos) continue; // Skip overlapping
      
      // Text before match
      fragment.appendChild(document.createTextNode(text.slice(currentPos, match.index)));
      // Masked match
      fragment.appendChild(createMask(match.text));
      
      currentPos = match.index + match.text.length;
      maskedCount++;
    }
    fragment.appendChild(document.createTextNode(text.slice(currentPos)));

    node.parentNode.replaceChild(fragment, node);
    return maskedCount;
  }

  function scanPage() {
    let totalMasked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    
    for (const node of nodes) {
      totalMasked += scanNode(node);
    }
    return totalMasked;
  }

  // Mutation Guard
  let mutationTimer;
  function onMutation(mutations) {
    // Debounce scanning
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      const count = scanPage();
      window.dispatchEvent(new CustomEvent('blur-my-screen:pii-updated', { detail: { count } }));
    }, 500);
  }

  function initialize() {
    const settings = window.BlurMyScreenSettings?.get();
    
    // Check if targeting is enabled
    const checkEnabled = async () => {
      const s = await window.BlurMyScreenSettings.get();
      if (s.targetedMaskingEnabled) {
        const count = scanPage();
        window.dispatchEvent(new CustomEvent('blur-my-screen:pii-updated', { detail: { count } }));
        
        const observer = new MutationObserver(onMutation);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    // Wait for settings to be available
    if (window.BlurMyScreenSettings) {
      checkEnabled();
    } else {
      // Polling or event-based wait
      const timer = setInterval(async () => {
        if (window.BlurMyScreenSettings) {
          clearInterval(timer);
          checkEnabled();
        }
      }, 100);
    }
  }

  window.BlurMyScreenPII = { initialize, scanPage };
  initialize();
})();
