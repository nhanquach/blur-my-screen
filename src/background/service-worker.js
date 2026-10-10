importScripts('../shared/messages.js');

const MESSAGES = self.BlurMyScreenMessages;
const TAB_STATE_KEY = 'blurMyScreenTabState';
let focusedWindowId;
let stateQueue = Promise.resolve();
let initializePromise;

function updateTabState(tabId, update) {
  stateQueue = stateQueue.catch(() => undefined).then(async () => {
    const stored = await chrome.storage.session.get(TAB_STATE_KEY);
    const states = stored[TAB_STATE_KEY] || {};
    const old = states[tabId];
    const next = typeof update === 'function' ? update(old) : update;
    if (next && (next.manualLocked || next.presentation)) states[tabId] = next;
    else delete states[tabId];
    await chrome.storage.session.set({ [TAB_STATE_KEY]: states });
    return states[tabId] || {};
  });
  return stateQueue;
}
async function getTabState(tabId) { await stateQueue; const stored = await chrome.storage.session.get(TAB_STATE_KEY); const value = stored[TAB_STATE_KEY]?.[tabId]; return value && typeof value === 'object' ? value : {}; }
async function send(tabId, type, extra = {}) { if (!Number.isInteger(tabId)) return false; try { await chrome.tabs.sendMessage(tabId, { type, ...extra }); return true; } catch { return false; } }
async function sendToTabs(query, type) { const tabs = await chrome.tabs.query(query); await Promise.all(tabs.map((tab) => send(tab.id, type))); }
async function activeTabInWindow(windowId) { if (!Number.isInteger(windowId)) return undefined; return (await chrome.tabs.query({ active: true, windowId }))[0]; }

function initialize() {
  if (initializePromise) return initializePromise;
  initializePromise = (async () => {
    await chrome.idle.setDetectionInterval(15);
    const focused = await chrome.windows.getLastFocused().catch(() => undefined);
    focusedWindowId = focused?.id;
    // Drop stale entries left by older extension versions or removed tabs.
    const tabs = await chrome.tabs.query({}); const ids = new Set(tabs.map((tab) => String(tab.id)));
    await stateQueue.catch(() => undefined); // serialize cleanup after any racing state write
    const stored = await chrome.storage.session.get(TAB_STATE_KEY); const states = stored[TAB_STATE_KEY] || {};
    let dirty = false; for (const [id, value] of Object.entries(states)) if (!ids.has(id) || !value || typeof value !== 'object') { delete states[id]; dirty = true; }
    if (dirty) await chrome.storage.session.set({ [TAB_STATE_KEY]: states });
  })().catch(() => undefined);
  return initializePromise;
}
initialize();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return undefined;
  if (message?.type === MESSAGES.LOCK_STATE) {
    updateTabState(tabId, (state = {}) => ({ ...state, manualLocked: Boolean(message.manualLocked) })).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false })); return true;
  }
  if (message?.type === MESSAGES.GET_LOCK_STATE) { getTabState(tabId).then((state) => sendResponse({ manualLocked: state.manualLocked === true, presentation: state.presentation === true })).catch(() => sendResponse({ manualLocked: false, presentation: false })); return true; }
  return undefined;
});

// Popup requests have no sender.tab. Persist manual state before delivering the command.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGES.LOCK || !Number.isInteger(message.tabId)) return undefined;
  updateTabState(message.tabId, (state = {}) => ({ ...state, manualLocked: true })).then(async () => {
    if (await send(message.tabId, MESSAGES.LOCK, { persisted: true })) sendResponse({ ok: true });
    else { await updateTabState(message.tabId, (state = {}) => ({ ...state, manualLocked: false })); sendResponse({ ok: false }); }
  }).catch(() => sendResponse({ ok: false })); return true;
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGES.SET_PRESENTATION || !Number.isInteger(message.tabId)) return undefined;
  updateTabState(message.tabId, (state = {}) => ({ ...state, presentation: Boolean(message.enabled) })).then(async (state) => {
    const delivered = await send(message.tabId, MESSAGES.SET_PRESENTATION, { enabled: state.presentation === true }); sendResponse({ ok: delivered, enabled: state.presentation === true });
  }).catch(() => sendResponse({ ok: false })); return true;
});

chrome.tabs.onRemoved.addListener((tabId) => { updateTabState(tabId, () => ({})).catch(() => undefined); });
chrome.tabs.onReplaced.addListener((_added, removed) => { updateTabState(removed, () => ({})).catch(() => undefined); });
chrome.idle.onStateChanged.addListener((state) => { if (state === 'idle' || state === 'locked') sendToTabs({ active: true, currentWindow: true }, MESSAGES.AUTO_LOCK); else if (state === 'active') sendToTabs({ active: true, currentWindow: true }, MESSAGES.RESET); });
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await initialize(); const previous = focusedWindowId; focusedWindowId = windowId === chrome.windows.WINDOW_ID_NONE ? undefined : windowId;
  if (previous !== undefined && previous !== focusedWindowId) { const tab = await activeTabInWindow(previous); await send(tab?.id, MESSAGES.FOCUS_LOSS); }
  if (focusedWindowId !== undefined) { const tab = await activeTabInWindow(focusedWindowId); await send(tab?.id, MESSAGES.RESET); }
});
chrome.runtime.onInstalled.addListener(initialize); chrome.runtime.onStartup.addListener(initialize);
