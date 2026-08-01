const KEY = "dementiaguard.history";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function loadHistory() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    return JSON.parse(storage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function addEvent(event) {
  const list = loadHistory();
  list.unshift(event);
  saveHistory(list);
  return list;
}

export function saveHistory(list) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(list));
}

export function clearHistory() {
  saveHistory([]);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}