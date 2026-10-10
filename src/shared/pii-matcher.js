(() => {
  'use strict';
  const root = typeof window === 'undefined' ? self : window;
  function isLuhnValid(value) {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || /^0+$/.test(digits)) return false;
    let sum = 0; let doubleIt = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) { let digit = Number(digits[index]); if (doubleIt && (digit *= 2) > 9) digit -= 9; sum += digit; doubleIt = !doubleIt; }
    return sum % 10 === 0;
  }
  function pushAll(results, expression, text, category, confidence) { for (const match of text.matchAll(expression)) results.push({ index: match.index, text: match[0], category, confidence }); }
  function matchesFor(text, options = {}) {
    const categories = options.categories || {}; const sensitivity = options.sensitivity || 'balanced'; const results = [];
    if (categories.email !== false) pushAll(results, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, text, 'email', 100);
    if (categories.paymentCard !== false) for (const match of text.matchAll(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g)) if (isLuhnValid(match[0])) results.push({ index: match.index, text: match[0], category: 'paymentCard', confidence: 95 });
    if (categories.currency !== false) {
      const currency = sensitivity === 'strict' ? /(?:[$€£¥]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP|JPY)\b)/g : /(?:[$€£¥]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
      pushAll(results, currency, text, 'currency', 70);
    }
    // Names require a label; this intentionally avoids masking prose such as article headings.
    if (categories.labeledName !== false && sensitivity !== 'conservative') for (const match of text.matchAll(/\b(?:full\s+name|patient|client|account\s+holder)\s*:\s*([A-Z][a-z]{1,}(?:\s+[A-Z][a-z'-]{1,}){1,3})\b/gi)) {
      const name = match[1]; results.push({ index: match.index + match[0].lastIndexOf(name), text: name, category: 'labeledName', confidence: 80 });
    }
    return results.sort((a, b) => b.confidence - a.confidence || b.text.length - a.text.length || a.index - b.index).reduce((selected, match) => {
      const overlaps = selected.some((item) => match.index < item.index + item.text.length && item.index < match.index + match.text.length);
      if (!overlaps) selected.push(match); return selected;
    }, []).sort((a, b) => a.index - b.index);
  }
  root.BlurMyScreenPiiMatcher = { isLuhnValid, matchesFor };
})();
