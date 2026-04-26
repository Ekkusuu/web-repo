export const STORAGE_KEYS = {
  theme: 'anilog.theme',
  library: 'anilog.library',
  session: 'anilog.session',
}

export function readStoredValue(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key)
    return rawValue ? JSON.parse(rawValue) : fallback
  } catch {
    return fallback
  }
}

export function writeStoredValue(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function createEmptyResults() {
  return {
    anime: [],
    manga: [],
  }
}
