const KEY = "dementiaguard.history";

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
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
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearHistory() {
  saveHistory([]);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}