export const STORAGE_KEYS = {
  theme: 'anilog7.theme',
  token: 'anilog7.token',
  auth: 'anilog7.auth',
}

const API_BASE = 'https://api.jikan.moe/v4'
const MIN_REQUEST_GAP_MS = 450
const FALLBACK_RETRY_DELAY_MS = 1500
const MAX_RATE_LIMIT_RETRIES = 2
const CACHE_PREFIX = 'anilog7.api.'
const DISCOVER_CACHE_TTL_MS = 10 * 60 * 1000
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000

let requestQueue = Promise.resolve()
let lastRequestAt = 0

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
  return normalizeListResponse(await requestApi(`${API_BASE}/seasons/now?limit=8&page=${page}`), 'anime', 'seasonal')
}

export async function fetchTopManga(page = 1) {
  return normalizeListResponse(await requestApi(`${API_BASE}/top/manga?limit=8&page=${page}`), 'manga', 'ranking')
}

export async function fetchTopNovels(page = 1) {
  return normalizeListResponse(await requestApi(`${API_BASE}/top/manga?type=novel&limit=8&page=${page}`), 'manga', 'novel')
}

export async function searchCatalog(kind, query) {
  const safeKind = kind === 'manga' ? 'manga' : 'anime'
  return normalizeListResponse(await requestApi(`${API_BASE}/${safeKind}?q=${encodeURIComponent(query)}&limit=12`), safeKind, 'search')
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
    liked: false,
    url: node.url || `https://myanimelist.net/${kind}/${node.mal_id}`,
  }
}

function requestApi(url) {
  const nextRequest = requestQueue.then(async () => {
    const cachedPayload = readCachedResponse(url)

    if (cachedPayload) {
      return cachedPayload
    }

    const waitTime = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt))
    if (waitTime) {
      await delay(waitTime)
    }

    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      const response = await fetch(url)
      lastRequestAt = Date.now()

      if (response.status !== 429) {
        const payload = await readApiResponse(response)
        writeCachedResponse(url, payload)
        return payload
      }

      if (attempt === MAX_RATE_LIMIT_RETRIES) {
        return readApiResponse(response)
      }

      await delay(getRetryDelayMs(response))
    }

    throw new Error('public_api_request_failed')
  })

  requestQueue = nextRequest.catch(() => {})
  return nextRequest
}

function readCachedResponse(url) {
  const ttl = getCacheTtlMs(url)
  if (!ttl) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(`${CACHE_PREFIX}${url}`)
    if (!rawValue) {
      return null
    }

    const cachedValue = JSON.parse(rawValue)
    if (!cachedValue?.expiresAt || cachedValue.expiresAt <= Date.now()) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${url}`)
      return null
    }

    return cachedValue.payload || null
  } catch {
    return null
  }
}

function writeCachedResponse(url, payload) {
  const ttl = getCacheTtlMs(url)
  if (!ttl) {
    return
  }

  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${url}`,
      JSON.stringify({
        expiresAt: Date.now() + ttl,
        payload,
      }),
    )
  } catch {
    // Ignore storage failures and fall back to network.
  }
}

function getCacheTtlMs(url) {
  if (url.includes('/anime?q=') || url.includes('/manga?q=')) {
    return SEARCH_CACHE_TTL_MS
  }

  if (url.includes('/seasons/now') || url.includes('/top/manga')) {
    return DISCOVER_CACHE_TTL_MS
  }

  return 0
}

function getRetryDelayMs(response) {
  const retryAfterSeconds = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000
  }

  return FALLBACK_RETRY_DELAY_MS
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
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
