const API_ROOT = 'http://localhost:3001'

export async function requestToken(payload) {
  return requestJson(`${API_ROOT}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function fetchEntries(token, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    query.set(key, String(value))
  })

  const suffix = query.size ? `?${query.toString()}` : ''
  return requestJson(`${API_ROOT}/api/entries${suffix}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function createEntry(token, payload) {
  return requestJson(`${API_ROOT}/api/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

export async function updateEntry(token, entryId, payload) {
  return requestJson(`${API_ROOT}/api/entries/${entryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteEntry(token, entryId) {
  return requestJson(`${API_ROOT}/api/entries/${entryId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

function requestJson(url, options = {}) {
  return fetch(url, options).then(async (response) => {
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.message || 'api_request_failed')
    }

    return payload
  })
}
