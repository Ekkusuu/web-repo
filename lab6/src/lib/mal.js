export const STORAGE_KEYS = {
  theme: 'anilog.theme',
  library: 'anilog.library',
  session: 'anilog.session',
}

const API_BASE = 'https://api.myanimelist.net/v2'
const OAUTH_BASE = 'https://myanimelist.net/v1/oauth2'

const DISCOVER_FIELDS = 'id,title,main_picture,mean,media_type,synopsis'
const AUTH_STATE_KEY = 'anilog.auth.state'
const AUTH_VERIFIER_KEY = 'anilog.auth.verifier'

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

export function getMalRedirectUri() {
  const configured = String(import.meta.env.VITE_MAL_REDIRECT_URI || '').trim()
  return configured || window.location.href.split(/[?#]/)[0]
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

export function beginMalLogin() {
  const clientId = getMalClientId()
  if (!clientId) {
    throw new Error('set VITE_MAL_CLIENT_ID in lab6/.env')
  }

  const state = createOAuthToken(24)
  const verifier = createOAuthToken(64)
  const redirectUri = getMalRedirectUri()

  window.sessionStorage.setItem(AUTH_STATE_KEY, state)
  window.sessionStorage.setItem(AUTH_VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
    code_challenge: verifier,
    code_challenge_method: 'plain',
  })

  window.location.assign(`${OAUTH_BASE}/authorize?${params.toString()}`)
}

export async function finalizeMalLogin(searchParams) {
  const clientId = getMalClientId()
  const redirectUri = getMalRedirectUri()
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const expectedState = window.sessionStorage.getItem(AUTH_STATE_KEY)
  const verifier = window.sessionStorage.getItem(AUTH_VERIFIER_KEY)

  if (!code) {
    throw new Error('missing_mal_authorization_code')
  }

  if (!state || state !== expectedState) {
    throw new Error('mal_state_mismatch')
  }

  if (!verifier) {
    throw new Error('missing_mal_code_verifier')
  }

  const payload = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })

  clearPendingAuth()
  return normalizeSession(await readApiResponse(response))
}

export async function refreshMalSession(session) {
  if (!session?.refreshToken) {
    throw new Error('missing_mal_refresh_token')
  }

  if (session.expiresAt && session.expiresAt > Date.now()) {
    return session
  }

  const payload = new URLSearchParams({
    client_id: getMalClientId(),
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  })

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })

  return normalizeSession(await readApiResponse(response))
}

export async function fetchViewerProfile(accessToken) {
  const response = await fetch(`${API_BASE}/users/@me?fields=anime_statistics`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return readApiResponse(response)
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

function clearPendingAuth() {
  window.sessionStorage.removeItem(AUTH_STATE_KEY)
  window.sessionStorage.removeItem(AUTH_VERIFIER_KEY)
}

function normalizeSession(payload) {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Number(payload.expires_in || 0) * 1000 - 60_000,
  }
}

function createOAuthToken(length) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}
