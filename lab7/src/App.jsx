import { useEffect, useRef, useState } from 'react'
import asciiLogo from './logo.txt?raw'
import {
  STORAGE_KEYS,
  createEmptyResults,
  fetchSeasonalAnime,
  fetchTopManga,
  fetchTopNovels,
  readStoredValue,
  searchCatalog,
  writeStoredValue,
} from './lib/publicCatalog'
import { createEntry, deleteEntry, fetchEntries, requestToken, updateEntry } from './lib/api'

const API_DOCS_URL = 'http://localhost:3001/docs'
const OPENAPI_URL = 'http://localhost:3001/openapi.json'
const PAGE_SIZE = 12

const VIEWS = [
  { id: 'discover', label: 'discover' },
  { id: 'search', label: 'search' },
  { id: 'library', label: 'library' },
  { id: 'api', label: 'api' },
]

const SEARCH_KIND_OPTIONS = [
  { value: 'anime', label: 'kind:anime' },
  { value: 'manga', label: 'kind:manga' },
]

const LIBRARY_KIND_OPTIONS = [
  { value: 'all', label: 'kind:all' },
  { value: 'anime', label: 'kind:anime' },
  { value: 'manga', label: 'kind:manga' },
]

const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'source:all' },
  { value: 'seasonal', label: 'source:seasonal' },
  { value: 'ranking', label: 'source:ranking' },
  { value: 'novel', label: 'source:novel' },
  { value: 'search', label: 'source:search' },
]

const ROLE_OPTIONS = [
  { value: 'VISITOR', label: 'role:visitor' },
  { value: 'WRITER', label: 'role:writer' },
  { value: 'ADMIN', label: 'role:admin' },
]

const PERMISSION_OPTIONS = ['READ', 'WRITE', 'DELETE']

export default function App() {
  const [theme, setTheme] = useState(() => readStoredValue(STORAGE_KEYS.theme, 'dark'))
  const [tokenState, setTokenState] = useState(() => readStoredValue(STORAGE_KEYS.token, null))
  const [authConfig, setAuthConfig] = useState(() =>
    readStoredValue(STORAGE_KEYS.auth, { role: 'WRITER', permissions: ['READ', 'WRITE'] }),
  )
  const [activeView, setActiveView] = useState('discover')
  const [results, setResults] = useState(() => createEmptyResults())
  const [discoverPages, setDiscoverPages] = useState({ anime: 1, manga: 1, novels: 1 })
  const [discoverHasMore, setDiscoverHasMore] = useState({ anime: true, manga: true, novels: true })
  const [discoverStatus, setDiscoverStatus] = useState('idle')
  const [discoverMessage, setDiscoverMessage] = useState('')
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false)
  const [discoverKind, setDiscoverKind] = useState('anime')
  const [searchKind, setSearchKind] = useState('anime')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMessage, setSearchMessage] = useState('')
  const [expandedKeys, setExpandedKeys] = useState([])
  const [libraryItems, setLibraryItems] = useState([])
  const [libraryMeta, setLibraryMeta] = useState({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false })
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryMessage, setLibraryMessage] = useState('Issue a token with READ permission to load entries.')
  const [libraryQuery, setLibraryQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [likedOnly, setLikedOnly] = useState(false)
  const [apiMessage, setApiMessage] = useState('Request a token to unlock the CRUD API.')
  const discoverLoadMoreRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStoredValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.token, tokenState)
  }, [tokenState])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.auth, authConfig)
  }, [authConfig])

  useEffect(() => {
    if (tokenState && isTokenExpired(tokenState)) {
      clearTokenState('Saved token expired. Request a fresh JWT.')
    }
  }, [])

  useEffect(() => {
    void loadDiscover()
  }, [])

  useEffect(() => {
    setExpandedKeys([])
  }, [discoverKind, activeView])

  useEffect(() => {
    if (activeView !== 'discover') {
      return
    }

    function maybeLoadMore() {
      const sentinel = discoverLoadMoreRef.current
      if (!sentinel) {
        return
      }

      if (discoverStatus !== 'ready' || discoverLoadingMore || !discoverHasMore[discoverKind]) {
        return
      }

      const rect = sentinel.getBoundingClientRect()
      if (rect.top <= window.innerHeight + 320) {
        void loadMoreDiscover(discoverKind)
      }
    }

    maybeLoadMore()
    window.addEventListener('scroll', maybeLoadMore, { passive: true })
    window.addEventListener('resize', maybeLoadMore)

    return () => {
      window.removeEventListener('scroll', maybeLoadMore)
      window.removeEventListener('resize', maybeLoadMore)
    }
  }, [activeView, discoverHasMore, discoverKind, discoverLoadingMore, discoverStatus])

  useEffect(() => {
    if (activeView !== 'library') {
      return
    }

    if (!hasPermission('READ')) {
      setLibraryItems([])
      setLibraryMeta({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false })
      setLibraryMessage('Issue a token with READ permission to load entries.')
      return
    }

    void loadLibrary({ reset: true })
  }, [activeView, tokenState, libraryQuery, kindFilter, sourceFilter, likedOnly])

  const stats = [
    ['saved', libraryMeta.total],
    ['loaded', libraryItems.length],
    ['liked', libraryItems.filter((entry) => entry.liked).length],
    ['token', tokenState ? 'live' : 'none'],
  ]

  const discoverItems = results[discoverKind] || []

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function resetClientState() {
    setExpandedKeys([])
    setLibraryQuery('')
    setKindFilter('all')
    setSourceFilter('all')
    setLikedOnly(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchMessage('')
  }

  function toggleExpanded(entryKey) {
    setExpandedKeys((current) =>
      current.includes(entryKey) ? current.filter((key) => key !== entryKey) : [...current, entryKey],
    )
  }

  function hasPermission(permission) {
    if (!tokenState || isTokenExpired(tokenState)) {
      return false
    }

    return (tokenState.permissions || []).includes(permission)
  }

  function findSavedEntry(entry) {
    return libraryItems.find(
      (savedEntry) =>
        savedEntry.kind === entry.kind &&
        ((savedEntry.malId && entry.id && savedEntry.malId === entry.id) || savedEntry.url === entry.url),
    )
  }

  function isSaved(entryKey) {
    return Boolean(findSavedEntry({ key: entryKey, ...splitCatalogKey(entryKey) }))
  }

  async function requestApiToken() {
    try {
      const tokenResponse = await requestToken(authConfig)
      const nextTokenState = {
        ...tokenResponse,
        expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
      }
      setTokenState(nextTokenState)
      setApiMessage(`token_ready role:${tokenResponse.role} perms:${tokenResponse.permissions.join(',')}`)
      setLibraryMessage('Token ready. Open library to load paginated entries.')
    } catch (error) {
      setApiMessage(error.message || 'token_request_failed')
    }
  }

  function clearTokenState(message = 'Token cleared.') {
    setTokenState(null)
    setApiMessage(message)
  }

  async function loadDiscover() {
    setDiscoverStatus('loading')
    setDiscoverMessage('loading_public_discovery_feeds')

    try {
      const [anime, manga, novels] = await Promise.all([
        fetchSeasonalAnime(),
        fetchTopManga(),
        fetchTopNovels(),
      ])
      setResults({ anime: anime.items, manga: manga.items, novels: novels.items })
      setDiscoverPages({ anime: 1, manga: 1, novels: 1 })
      setDiscoverHasMore({
        anime: anime.hasNextPage,
        manga: manga.hasNextPage,
        novels: novels.hasNextPage,
      })
      setDiscoverStatus('ready')
      setDiscoverMessage(`discover_ready ${anime.items.length} anime ${manga.items.length} manga ${novels.items.length} novels`)
    } catch (error) {
      setDiscoverStatus('error')
      setDiscoverMessage(error.message || 'discover_failed')
    }
  }

  async function loadMoreDiscover(kind) {
    if (discoverLoadingMore || !discoverHasMore[kind]) {
      return
    }

    setDiscoverLoadingMore(true)

    try {
      const nextPage = discoverPages[kind] + 1
      const nextBatch = await fetchDiscoverBatch(kind, nextPage)
      setResults((current) => ({
        ...current,
        [kind]: dedupeEntries([...current[kind], ...nextBatch.items]),
      }))
      setDiscoverPages((current) => ({ ...current, [kind]: nextPage }))
      setDiscoverHasMore((current) => ({ ...current, [kind]: nextBatch.hasNextPage }))
    } catch (error) {
      setDiscoverMessage(error.message || 'Could not load more entries.')
    } finally {
      setDiscoverLoadingMore(false)
    }
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchMessage('search_idle')
      return
    }

    setSearchMessage(`searching_${searchKind}`)

    try {
      const nextResults = await searchCatalog(searchKind, searchQuery.trim())
      setSearchResults(nextResults.items)
      setSearchMessage(`search_ready ${nextResults.items.length} results`)
    } catch (error) {
      setSearchResults([])
      setSearchMessage(error.message || 'search_failed')
    }
  }

  async function loadLibrary({ reset }) {
    const activeToken = getActiveTokenOrThrow()
    const offset = reset ? 0 : libraryMeta.offset + libraryMeta.limit
    const params = {
      limit: PAGE_SIZE,
      offset,
      q: libraryQuery || undefined,
      kind: kindFilter === 'all' ? undefined : kindFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      liked: likedOnly ? true : undefined,
    }

    setLibraryLoading(true)
    setLibraryMessage(reset ? 'Loading entries...' : 'Loading more entries...')

    try {
      const response = await fetchEntries(activeToken, params)
      const normalizedItems = response.items.map(normalizeApiEntry)
      setLibraryItems((current) => (reset ? normalizedItems : dedupeEntries([...current, ...normalizedItems])))
      setLibraryMeta({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
      })
      setLibraryMessage(response.total ? `${response.total} entries available via API.` : 'No entries matched the current API filter.')
    } catch (error) {
      setLibraryItems(reset ? [] : libraryItems)
      setLibraryMessage(error.message || 'library_load_failed')
    } finally {
      setLibraryLoading(false)
    }
  }

  async function saveEntryToApi(entry) {
    if (!hasPermission('WRITE')) {
      setApiMessage('WRITE permission is required to create entries.')
      return
    }

    try {
      const activeToken = getActiveTokenOrThrow()
      await createEntry(activeToken, toApiEntryPayload(entry))
      setApiMessage(`entry_saved ${entry.title}`)
      if (activeView === 'library' || hasPermission('READ')) {
        await loadLibrary({ reset: true })
      }
    } catch (error) {
      setApiMessage(error.message || 'entry_create_failed')
    }
  }

  async function toggleLike(entry) {
    if (!hasPermission('WRITE')) {
      setApiMessage('WRITE permission is required to update entries.')
      return
    }

    try {
      const activeToken = getActiveTokenOrThrow()
      const updatedEntry = await updateEntry(activeToken, entry.id, { ...entry, liked: !entry.liked })
      setLibraryItems((current) => current.map((item) => (item.id === entry.id ? normalizeApiEntry(updatedEntry) : item)))
      setApiMessage(`entry_updated ${entry.title}`)
    } catch (error) {
      setApiMessage(error.message || 'entry_update_failed')
    }
  }

  async function removeEntryFromApi(entry) {
    if (!hasPermission('DELETE')) {
      setApiMessage('DELETE permission is required to remove entries.')
      return
    }

    try {
      const activeToken = getActiveTokenOrThrow()
      await deleteEntry(activeToken, entry.id)
      setLibraryItems((current) => current.filter((item) => item.id !== entry.id))
      setLibraryMeta((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }))
      setApiMessage(`entry_deleted ${entry.title}`)
    } catch (error) {
      setApiMessage(error.message || 'entry_delete_failed')
    }
  }

  function getActiveTokenOrThrow() {
    if (!tokenState) {
      throw new Error('request_a_token_first')
    }

    if (isTokenExpired(tokenState)) {
      clearTokenState('Saved token expired. Request a fresh JWT.')
      throw new Error('saved_token_expired')
    }

    return tokenState.token
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <section className="brand-block">
          <pre className="ascii-mark">{asciiLogo}</pre>
          <div className="brand-copy-block">
            <h1 className="brand-title">AniLog Terminal</h1>
            <p className="panel-copy">public anime and manga discovery vault</p>
          </div>
        </section>

        <nav className="menu-list" aria-label="Views">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              className={`menu-button ${item.id === activeView ? 'menu-button-active' : ''}`}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="sidebar-panel">
          <p className="section-title">status</p>
          <dl className="meta-list">
            <div><dt>theme</dt><dd>{theme}</dd></div>
            <div><dt>role</dt><dd>{tokenState?.role || 'none'}</dd></div>
            <div><dt>token</dt><dd>{tokenState ? (isTokenExpired(tokenState) ? 'expired' : 'ready') : 'missing'}</dd></div>
            <div><dt>perms</dt><dd>{tokenState?.permissions?.join('|') || 'none'}</dd></div>
            <div><dt>expires</dt><dd>{tokenState ? formatExpiry(tokenState.expiresAt) : 'n/a'}</dd></div>
            <div><dt>entries</dt><dd>{String(libraryMeta.total).padStart(4, '0')}</dd></div>
          </dl>
        </section>

        <section className="sidebar-panel">
          <p className="section-title">counts</p>
          <div className="stat-lines">
            {stats.map(([label, value]) => (
              <p key={label} className="stat-line">
                <span>{label}</span>
                <strong>{String(value).padStart(4, '0')}</strong>
              </p>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="command-bar">
          <span>{`anilog-api / ${activeView}`}</span>
          <div className="command-actions">
            <button className="command-button" type="button" onClick={loadDiscover}>refresh discovery</button>
            <button className="command-button" type="button" onClick={toggleTheme}>theme</button>
            <button className="command-button" type="button" onClick={resetClientState}>reset ui</button>
          </div>
        </header>

        {activeView === 'discover' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">discover.queue</p>
                <p className="panel-copy">public discovery feed for anime, manga, and novels</p>
              </div>
              <div className="toggle-list">
                {['anime', 'manga', 'novels'].map((kind) => (
                  <button
                    key={kind}
                    className={`toggle-chip ${discoverKind === kind ? 'toggle-chip-active' : ''}`}
                    type="button"
                    onClick={() => setDiscoverKind(kind)}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            <section className="subpanel">
              <p className="section-title">{`${discoverKind}.feed`}</p>
              {discoverItems.length ? (
                renderCatalogGrid(discoverItems, expandedKeys, toggleExpanded, findSavedEntry, saveEntryToApi)
              ) : (
                <p className="empty-line">{getDiscoverEmptyMessage(discoverKind, discoverStatus, discoverMessage)}</p>
              )}
              {discoverItems.length && discoverLoadingMore ? <p className="empty-line">Loading more...</p> : null}
              {discoverItems.length && !discoverHasMore[discoverKind] ? <p className="empty-line">End of feed.</p> : null}
              <div ref={discoverLoadMoreRef} className="load-more-sentinel" aria-hidden="true" />
            </section>
          </section>
        ) : null}

        {activeView === 'search' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <form className="search-form" onSubmit={handleSearch}>
                <p className="section-title">search.shell</p>
                <p className="panel-copy">search the public anime or manga catalog</p>
                <div className="filter-grid search-grid">
                  <input
                    className="field"
                    type="search"
                    placeholder="search title"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  <SelectField value={searchKind} options={SEARCH_KIND_OPTIONS} onChange={setSearchKind} />
                  <button className="command-button" type="submit">run search</button>
                </div>
              </form>
            </div>

            {searchResults.length ? (
              renderCatalogGrid(searchResults, expandedKeys, toggleExpanded, findSavedEntry, saveEntryToApi)
            ) : (
              <p className="empty-line">{searchMessage || 'Run a search to load results.'}</p>
            )}
          </section>
        ) : null}

        {activeView === 'library' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">library.api</p>
                <p className="panel-copy">API-backed saved entries with pagination and JWT permissions</p>
              </div>

              <div className="filter-grid library-grid">
                <input
                  className="field"
                  type="search"
                  placeholder="grep title note"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                />
                <SelectField value={kindFilter} options={LIBRARY_KIND_OPTIONS} onChange={setKindFilter} />
                <SelectField value={sourceFilter} options={SOURCE_FILTER_OPTIONS} onChange={setSourceFilter} />
                <button className="command-button" type="button" onClick={() => setLikedOnly((current) => !current)}>
                  {likedOnly ? 'liked:on' : 'liked:off'}
                </button>
              </div>
            </div>

            <p className="form-help">{libraryMessage}</p>

            {libraryItems.length ? (
              <div className="entry-list">
                {libraryItems.map((entry) => (
                  <article
                    key={entry.id}
                    className={`media-card media-entry media-library ${expandedKeys.includes(entry.id) ? 'media-card-open' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(entry.id)}
                    onKeyDown={(event) => handleEntryKeyDown(event, entry.id, toggleExpanded)}
                  >
                    {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
                    <div>
                      <p className="card-kicker">{entry.kind}</p>
                      <h2 className="card-title">{entry.title}</h2>
                      <p className="card-copy">
                        {expandedKeys.includes(entry.id)
                          ? entry.synopsis || entry.note || 'No synopsis available.'
                          : entry.note || truncateText(entry.synopsis, 160)}
                      </p>
                      <TagList tags={entry.tags} />
                    </div>
                    <div className="inline-actions">
                      <span className="tag">{entry.source}</span>
                      <button className="inline-button" type="button" onClick={(event) => handleActionClick(event, () => toggleLike(entry))}>
                        {entry.liked ? 'unlike' : 'like'}
                      </button>
                      <button className="inline-button" type="button" onClick={(event) => handleActionClick(event, () => removeEntryFromApi(entry))}>
                        delete
                      </button>
                      <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer" onClick={stopTogglePropagation}>
                        open
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-line">{hasPermission('READ') ? 'No API entries loaded yet.' : 'READ permission is required to browse saved entries.'}</p>
            )}

            {libraryMeta.hasMore ? (
              <button className="command-button" type="button" onClick={() => loadLibrary({ reset: false })} disabled={libraryLoading}>
                {libraryLoading ? 'loading...' : 'load more'}
              </button>
            ) : null}
          </section>
        ) : null}

        {activeView === 'api' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">api.control</p>
                <p className="panel-copy">request a one-minute JWT, inspect permissions, and use the documented API</p>
              </div>
            </div>

            <section className="subpanel">
              <p className="section-title">token.request</p>
              <div className="auth-grid">
                <div className="form-grid">
                  <SelectField value={authConfig.role} options={ROLE_OPTIONS} onChange={(role) => setAuthConfig((current) => ({ ...current, role }))} />
                  <div className="toggle-list">
                    {PERMISSION_OPTIONS.map((permission) => {
                      const selected = authConfig.permissions.includes(permission)
                      return (
                        <button
                          key={permission}
                          className={`toggle-chip ${selected ? 'toggle-chip-active' : ''}`}
                          type="button"
                          onClick={() => setAuthConfig((current) => ({
                            ...current,
                            permissions: togglePermission(current.permissions, permission),
                          }))}
                        >
                          {permission}
                        </button>
                      )
                    })}
                  </div>
                  <div className="inline-actions">
                    <button className="command-button" type="button" onClick={requestApiToken}>request token</button>
                    <button className="command-button" type="button" onClick={() => clearTokenState('Token cleared manually.')}>clear token</button>
                  </div>
                  <p className="form-help">{apiMessage}</p>
                </div>

                <div className="stack-list">
                  <div className="media-card">
                    <p className="section-title">token.info</p>
                    <p className="token-preview">
                      {tokenState
                        ? `role=${tokenState.role}\npermissions=${tokenState.permissions.join(', ')}\nexpires_at=${new Date(tokenState.expiresAt).toLocaleTimeString()}`
                        : 'No token issued yet.'}
                    </p>
                  </div>
                  <div className="media-card">
                    <p className="section-title">api.links</p>
                    <div className="line-list">
                      <a className="inline-link" href={API_DOCS_URL} target="_blank" rel="noreferrer">open swagger ui</a>
                      <a className="inline-link" href={OPENAPI_URL} target="_blank" rel="noreferrer">open openapi json</a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="subpanel">
              <p className="section-title">api.endpoints</p>
              <div className="api-table">
                <article className="api-row">
                  <div>
                    <h3>POST /token</h3>
                    <p>returns a short-lived JWT that stores role and permissions</p>
                  </div>
                  <span className="tag">public</span>
                </article>
                <article className="api-row">
                  <div>
                    <h3>GET /api/entries</h3>
                    <p>paginated read with limit, offset, q, kind, source, and liked filters</p>
                  </div>
                  <span className="tag">READ</span>
                </article>
                <article className="api-row">
                  <div>
                    <h3>POST /api/entries</h3>
                    <p>create a saved entry from discovery or search results</p>
                  </div>
                  <span className="tag">WRITE</span>
                </article>
                <article className="api-row">
                  <div>
                    <h3>PUT /api/entries/:id</h3>
                    <p>update note, liked state, and other stored entry fields</p>
                  </div>
                  <span className="tag">WRITE</span>
                </article>
                <article className="api-row">
                  <div>
                    <h3>DELETE /api/entries/:id</h3>
                    <p>remove an entry from the saved vault</p>
                  </div>
                  <span className="tag">DELETE</span>
                </article>
              </div>
            </section>
          </section>
        ) : null}
      </section>
    </main>
  )
}

function SelectField({ value, options, onChange }) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function renderCatalogGrid(entries, expandedKeys, toggleExpanded, findSavedEntry, saveEntryToApi) {
  return (
    <div className="entry-list">
      {entries.map((entry) => {
        const savedEntry = findSavedEntry(entry)

        return (
          <article
            key={entry.key}
            className={`media-card media-entry ${expandedKeys.includes(entry.key) ? 'media-card-open' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => toggleExpanded(entry.key)}
            onKeyDown={(event) => handleEntryKeyDown(event, entry.key, toggleExpanded)}
          >
            {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
            <div>
              <p className="card-kicker">{entry.mediaType || entry.kind}</p>
              <h2 className="card-title">{entry.title}</h2>
              <p className="card-copy">
                {expandedKeys.includes(entry.key) ? entry.synopsis || 'No synopsis available.' : truncateText(entry.synopsis, 160)}
              </p>
              <TagList tags={entry.tags} />
            </div>
            <div className="inline-actions">
              <span className="tag">{entry.score ? `score:${entry.score}` : 'score:na'}</span>
              <button className="inline-button" type="button" onClick={(event) => handleActionClick(event, () => !savedEntry && saveEntryToApi(entry))}>
                {savedEntry ? 'saved' : 'save'}
              </button>
              <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer" onClick={stopTogglePropagation}>
                open
              </a>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function TagList({ tags }) {
  if (!tags?.length) {
    return null
  }

  return (
    <div className="detail-tags">
      <div className="tag-list">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function handleActionClick(event, action) {
  event.stopPropagation()
  action()
}

function stopTogglePropagation(event) {
  event.stopPropagation()
}

function handleEntryKeyDown(event, entryKey, toggleExpanded) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  toggleExpanded(entryKey)
}

function normalizeApiEntry(entry) {
  return {
    ...entry,
    key: entry.id,
  }
}

function toApiEntryPayload(entry) {
  return {
    title: entry.title,
    kind: entry.kind,
    image: entry.image,
    synopsis: entry.synopsis,
    score: entry.score,
    mediaType: entry.mediaType,
    tags: entry.tags,
    source: entry.source,
    liked: false,
    note: buildSourceNote(entry.source),
    url: entry.url,
    malId: entry.id,
  }
}

function isTokenExpired(tokenState) {
  return !tokenState?.expiresAt || tokenState.expiresAt <= Date.now()
}

function togglePermission(currentPermissions, permission) {
  return currentPermissions.includes(permission)
    ? currentPermissions.filter((item) => item !== permission)
    : [...currentPermissions, permission]
}

function truncateText(value, maxLength) {
  if (!value) {
    return 'no_synopsis_available'
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

function buildSourceNote(source) {
  if (source === 'seasonal') {
    return 'saved from the current season feed'
  }

  if (source === 'ranking') {
    return 'saved from the top manga ranking'
  }

  if (source === 'novel') {
    return 'saved from the top novel ranking'
  }

  if (source === 'search') {
    return 'saved from catalog search results'
  }

  return 'saved in the API vault'
}

function getDiscoverEmptyMessage(kind, status, message) {
  if (status === 'loading') {
    if (kind === 'anime') return 'Loading seasonal anime...'
    if (kind === 'manga') return 'Loading top manga...'
    return 'Loading top novels...'
  }

  if (status === 'error') {
    return message || `Could not load ${kind}.`
  }

  if (kind === 'anime') return 'Seasonal anime will appear here.'
  if (kind === 'manga') return 'Top manga will appear here.'
  return 'Top novels will appear here.'
}

async function fetchDiscoverBatch(kind, page) {
  if (kind === 'anime') {
    return fetchSeasonalAnime(page)
  }

  if (kind === 'manga') {
    return fetchTopManga(page)
  }

  return fetchTopNovels(page)
}

function dedupeEntries(entries) {
  return Array.from(new Map(entries.map((entry) => [entry.key, entry])).values())
}

function splitCatalogKey(key) {
  const [kind, rawId] = String(key).split('-')
  return {
    kind,
    id: Number(rawId),
  }
}

function formatExpiry(expiresAt) {
  if (!expiresAt) {
    return 'n/a'
  }

  return new Date(expiresAt).toLocaleTimeString()
}
