export const STORAGE_KEYS = {
  theme: 'anilog.theme',
  library: 'anilog.library',
}

const API_BASE = 'https://api.jikan.moe/v4'

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
    novels: [],
  }
}

export async function fetchSeasonalAnime(page = 1) {
  const response = await fetch(`${API_BASE}/seasons/now?limit=8&page=${page}`)
  return normalizeListResponse(await readApiResponse(response), 'anime', 'seasonal')
}

export async function fetchTopManga(page = 1) {
  const response = await fetch(`${API_BASE}/top/manga?limit=8&page=${page}`)
  return normalizeListResponse(await readApiResponse(response), 'manga', 'ranking')
}

export async function fetchTopNovels(page = 1) {
  const response = await fetch(`${API_BASE}/top/manga?type=novel&limit=8&page=${page}`)
  return normalizeListResponse(await readApiResponse(response), 'novel', 'novel')
}

export async function searchCatalog(kind, query) {
  const safeKind = kind === 'manga' ? 'manga' : 'anime'
  const response = await fetch(`${API_BASE}/${safeKind}?q=${encodeURIComponent(query)}&limit=12`)
  return normalizeListResponse(await readApiResponse(response), safeKind, 'search')
}

function normalizeTitleNode(node, kind, source) {
  return {
    key: `${kind}-${node.mal_id}`,
    id: node.mal_id,
    kind,
    title: node.title,
    image: node.images?.jpg?.large_image_url || node.images?.jpg?.image_url || '',
    synopsis: node.synopsis || '',
    score: node.score || null,
    mediaType: node.type || '',
    tags: extractTags(node),
    source,
    url: node.url || `https://myanimelist.net/${kind}/${node.mal_id}`,
  }
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'public_api_request_failed')
  }

  return payload
}

function normalizeListResponse(payload, kind, source) {
  const normalized = (payload.data || []).map((entry) => normalizeTitleNode(entry, kind, source))
  return {
    items: dedupeEntries(normalized),
    hasNextPage: Boolean(payload.pagination?.has_next_page),
  }
}

function dedupeEntries(entries) {
  return Array.from(new Map(entries.map((entry) => [entry.key, entry])).values())
}

function extractTags(node) {
  return [
    ...(node.genres || []).map((item) => item.name),
    ...(node.explicit_genres || []).map((item) => item.name),
    ...(node.themes || []).map((item) => item.name),
    ...(node.demographics || []).map((item) => item.name),
  ].filter(Boolean)
}
