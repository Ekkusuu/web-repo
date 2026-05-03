import express from 'express'
import cors from 'cors'
import { authenticateToken, authorizePermissions, issueToken } from './lib/auth.js'
import { readEntries, writeEntries } from './lib/store.js'

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok', message: 'lab7 api scaffold ready' })
})

app.post('/token', (request, response) => {
  const tokenPayload = issueToken(request.body || {})
  response.status(200).json(tokenPayload)
})

app.get('/api/entries', authenticateToken, authorizePermissions('READ'), async (request, response) => {
  const entries = await readEntries()
  const { limit, offset, kind, source, liked, q } = request.query
  const parsedLimit = clampNumber(limit, 20, 1, 100)
  const parsedOffset = clampNumber(offset, 0, 0, Number.MAX_SAFE_INTEGER)

  const filteredEntries = entries.filter((entry) => {
    if (kind && entry.kind !== kind) {
      return false
    }

    if (source && entry.source !== source) {
      return false
    }

    if (liked !== undefined) {
      const expectedLiked = String(liked) === 'true'
      if (Boolean(entry.liked) !== expectedLiked) {
        return false
      }
    }

    if (q) {
      const searchText = `${entry.title} ${entry.note || ''} ${entry.source || ''}`.toLowerCase()
      if (!searchText.includes(String(q).toLowerCase())) {
        return false
      }
    }

    return true
  })

  const pagedEntries = filteredEntries.slice(parsedOffset, parsedOffset + parsedLimit)
  response.status(200).json({
    items: pagedEntries,
    total: filteredEntries.length,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + parsedLimit < filteredEntries.length,
  })
})

app.get('/api/entries/:entryId', authenticateToken, authorizePermissions('READ'), async (request, response) => {
  const entries = await readEntries()
  const foundEntry = entries.find((entry) => entry.id === request.params.entryId)

  if (!foundEntry) {
    response.status(404).json({ message: 'entry_not_found' })
    return
  }

  response.status(200).json(foundEntry)
})

app.post('/api/entries', authenticateToken, authorizePermissions('WRITE'), async (request, response) => {
  const validationError = validateEntryPayload(request.body, true)
  if (validationError) {
    response.status(400).json({ message: validationError })
    return
  }

  const entries = await readEntries()
  const nextEntry = buildEntryRecord(request.body)
  entries.unshift(nextEntry)
  await writeEntries(entries)
  response.status(201).json(nextEntry)
})

app.put('/api/entries/:entryId', authenticateToken, authorizePermissions('WRITE'), async (request, response) => {
  const validationError = validateEntryPayload(request.body, false)
  if (validationError) {
    response.status(400).json({ message: validationError })
    return
  }

  const entries = await readEntries()
  const entryIndex = entries.findIndex((entry) => entry.id === request.params.entryId)

  if (entryIndex === -1) {
    response.status(404).json({ message: 'entry_not_found' })
    return
  }

  const updatedEntry = {
    ...entries[entryIndex],
    ...sanitizeEntryPayload(request.body),
    updatedAt: new Date().toISOString(),
  }

  entries[entryIndex] = updatedEntry
  await writeEntries(entries)
  response.status(200).json(updatedEntry)
})

app.delete('/api/entries/:entryId', authenticateToken, authorizePermissions('DELETE'), async (request, response) => {
  const entries = await readEntries()
  const entryIndex = entries.findIndex((entry) => entry.id === request.params.entryId)

  if (entryIndex === -1) {
    response.status(404).json({ message: 'entry_not_found' })
    return
  }

  entries.splice(entryIndex, 1)
  await writeEntries(entries)
  response.status(204).send()
})

app.listen(port, () => {
  console.log(`lab7 api listening on http://localhost:${port}`)
})

function clampNumber(value, fallback, min, max) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.min(Math.max(parsedValue, min), max)
}

function validateEntryPayload(payload, requireCoreFields) {
  if (!payload || typeof payload !== 'object') {
    return 'invalid_json_payload'
  }

  if (requireCoreFields && !String(payload.title || '').trim()) {
    return 'title_required'
  }

  if (requireCoreFields && !['anime', 'manga'].includes(String(payload.kind || ''))) {
    return 'kind_must_be_anime_or_manga'
  }

  return ''
}

function buildEntryRecord(payload) {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...sanitizeEntryPayload(payload),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function sanitizeEntryPayload(payload) {
  return {
    title: String(payload.title || '').trim(),
    kind: payload.kind === 'manga' ? 'manga' : 'anime',
    image: String(payload.image || ''),
    synopsis: String(payload.synopsis || ''),
    score: payload.score === null || payload.score === undefined ? null : Number(payload.score),
    mediaType: String(payload.mediaType || ''),
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag)) : [],
    source: String(payload.source || 'search'),
    liked: Boolean(payload.liked),
    note: String(payload.note || ''),
    url: String(payload.url || ''),
    malId: payload.malId === undefined ? null : Number(payload.malId),
  }
}
