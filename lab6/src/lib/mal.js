export const STORAGE_KEYS = {
  theme: 'anilog.theme',
  library: 'anilog.library',
  session: 'anilog.session',
}

const API_BASE = 'https://api.myanimelist.net/v2'

const DISCOVER_FIELDS = 'id,title,main_picture,mean,media_type,synopsis'

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

export function getMalClientId() {
  return String(import.meta.env.VITE_MAL_CLIENT_ID || '').trim()
}

export async function fetchSeasonalAnime() {
  const clientId = getMalClientId()
  if (!clientId) {
    throw new Error('set VITE_MAL_CLIENT_ID in lab6/.env')
  }

  const now = new Date()
  const season = ['winter', 'spring', 'summer', 'fall'][Math.floor(now.getMonth() / 3)]
  const response = await fetch(
    `${API_BASE}/anime/season/${now.getFullYear()}/${season}?limit=8&fields=${DISCOVER_FIELDS}`,
    {
      headers: {
        'X-MAL-CLIENT-ID': clientId,
      },
    },
  )

  return normalizeListResponse(await readApiResponse(response), 'anime', 'seasonal')
}

export async function fetchTopManga() {
  const clientId = getMalClientId()
  if (!clientId) {
    throw new Error('set VITE_MAL_CLIENT_ID in lab6/.env')
  }

  const response = await fetch(
    `${API_BASE}/manga/ranking?ranking_type=manga&limit=8&fields=${DISCOVER_FIELDS}`,
    {
      headers: {
        'X-MAL-CLIENT-ID': clientId,
      },
    },
  )

  return normalizeListResponse(await readApiResponse(response), 'manga', 'ranking')
}

export async function searchCatalog(kind, query) {
  const clientId = getMalClientId()
  if (!clientId) {
    throw new Error('set VITE_MAL_CLIENT_ID in lab6/.env')
  }

  const safeKind = kind === 'manga' ? 'manga' : 'anime'
  const response = await fetch(
    `${API_BASE}/${safeKind}?q=${encodeURIComponent(query)}&limit=12&fields=${DISCOVER_FIELDS}`,
    {
      headers: {
        'X-MAL-CLIENT-ID': clientId,
      },
    },
  )

  return normalizeListResponse(await readApiResponse(response), safeKind, 'search')
}

export function normalizeTitleNode(entry, kind, source) {
  const node = entry.node || entry
  return {
    key: `${kind}-${node.id}`,
    id: node.id,
    kind,
    title: node.title,
    image: node.main_picture?.medium || node.main_picture?.large || '',
    synopsis: node.synopsis || '',
    score: node.mean || null,
    mediaType: node.media_type || '',
    source,
    listStatus: entry.list_status?.status || '',
    url: `https://myanimelist.net/${kind}/${node.id}`,
  }
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'mal_request_failed')
  }

  return payload
}

function normalizeListResponse(payload, kind, source) {
  return (payload.data || []).map((entry) => normalizeTitleNode(entry, kind, source))
}
