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

export default function App() {
  const [theme, setTheme] = useState(() => readStoredValue(STORAGE_KEYS.theme, 'dark'))
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
  const [library, setLibrary] = useState([])
  const [libraryQuery, setLibraryQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [likedOnly, setLikedOnly] = useState(false)
  const discoverLoadMoreRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStoredValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    void loadDiscover()
  }, [])

  useEffect(() => {
    setExpandedKeys([])
  }, [discoverKind])

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

  const filteredLibrary = library.filter((entry) => {
    const matchesKind = kindFilter === 'all' || entry.kind === kindFilter
    const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter
    const matchesLiked = !likedOnly || entry.liked
    const searchText = `${entry.title} ${entry.kind} ${entry.note || ''} ${entry.source}`.toLowerCase()
    const matchesQuery = !libraryQuery || searchText.includes(libraryQuery.toLowerCase())
    return matchesKind && matchesSource && matchesLiked && matchesQuery
  })

  const stats = [
    ['anime', library.filter((entry) => entry.kind === 'anime').length],
    ['manga', library.filter((entry) => entry.kind === 'manga').length],
    ['liked', library.filter((entry) => entry.liked).length],
    ['saved', library.length],
  ]

  const discoverItems = results[discoverKind] || []

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function clearLibrary() {
    setLibrary([])
    setLibraryQuery('')
    setKindFilter('all')
    setSourceFilter('all')
    setLikedOnly(false)
    setExpandedKeys([])
  }

  function toggleExpanded(entryKey) {
    setExpandedKeys((current) =>
      current.includes(entryKey) ? current.filter((key) => key !== entryKey) : [...current, entryKey],
    )
  }

  function isSaved(entryKey) {
    return library.some((entry) => entry.key === entryKey)
  }

  function saveEntry(entry) {
    setLibrary((current) => {
      if (current.some((item) => item.key === entry.key)) {
        return current
      }

      return [
        {
          ...entry,
          liked: false,
          note: buildSourceNote(entry.source),
          addedAt: new Date().toISOString(),
        },
        ...current,
      ]
    })
  }

  function removeEntry(entryKey) {
    setLibrary((current) => current.filter((entry) => entry.key !== entryKey))
  }

  function toggleLike(entryKey) {
    setLibrary((current) =>
      current.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              liked: !entry.liked,
            }
          : entry,
      ),
    )
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <section className="brand-block">
          <pre className="ascii-mark">{asciiLogo}</pre>
          <div className="brand-copy-block">
            <h1 className="brand-title">AniLog API</h1>
            <p className="panel-copy">lab7 scaffold copied from lab6 before API integration</p>
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
            <div><dt>source</dt><dd>jikan + pending api</dd></div>
            <div><dt>mode</dt><dd>lab7 scaffold</dd></div>
            <div><dt>titles</dt><dd>{String(library.length).padStart(4, '0')}</dd></div>
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
            <button className="command-button" type="button" onClick={loadDiscover}>refresh</button>
            <button className="command-button" type="button" onClick={toggleTheme}>theme</button>
            <button className="command-button" type="button" onClick={clearLibrary}>clear local</button>
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
              {discoverItems.length ? renderEntryGrid(discoverItems, expandedKeys, toggleExpanded, isSaved, saveEntry, removeEntry, discoverKind) : (
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

            {searchResults.length ? renderEntryGrid(searchResults, expandedKeys, toggleExpanded, isSaved, saveEntry, removeEntry, 'search') : (
              <p className="empty-line">{searchMessage || 'Run a search to load results.'}</p>
            )}
          </section>
        ) : null}

        {activeView === 'library' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">library.vault</p>
                <p className="panel-copy">local copy of lab6 vault before backend CRUD wiring</p>
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

            {filteredLibrary.length ? (
              <div className="entry-list">
                {filteredLibrary.map((entry) => (
                  <article
                    key={entry.key}
                    className={`media-card media-entry media-library ${expandedKeys.includes(entry.key) ? 'media-card-open' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(entry.key)}
                    onKeyDown={(event) => handleEntryKeyDown(event, entry.key, toggleExpanded)}
                  >
                    {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
                    <div>
                      <p className="card-kicker">{entry.kind}</p>
                      <h2 className="card-title">{entry.title}</h2>
                      <p className="card-copy">
                        {expandedKeys.includes(entry.key)
                          ? entry.synopsis || entry.note || 'No synopsis available.'
                          : entry.note || 'local entry saved in browser storage'}
                      </p>
                      <TagList tags={entry.tags} />
                    </div>
                    <div className="inline-actions">
                      <span className="tag">{entry.source}</span>
                      <button className="inline-button" type="button" onClick={(event) => handleActionClick(event, () => toggleLike(entry.key))}>
                        {entry.liked ? 'unlike' : 'like'}
                      </button>
                      <button className="inline-button" type="button" onClick={(event) => handleActionClick(event, () => removeEntry(entry.key))}>
                        remove
                      </button>
                      <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer" onClick={stopTogglePropagation}>
                        open
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-line">library_empty_add_titles_from_discover_or_search</p>
            )}
          </section>
        ) : null}

        {activeView === 'api' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">api.backlog</p>
                <p className="panel-copy">the next commits will replace local vault state with a JWT-protected CRUD API</p>
              </div>
            </div>

            <div className="api-table">
              <article className="api-row">
                <div>
                  <h3>/token</h3>
                  <p>issue a short-lived JWT with role and permissions</p>
                </div>
                <span className="tag">pending</span>
              </article>
              <article className="api-row">
                <div>
                  <h3>/api/entries</h3>
                  <p>create, read, update, and delete saved vault entries with pagination</p>
                </div>
                <span className="tag">pending</span>
              </article>
              <article className="api-row">
                <div>
                  <h3>/docs</h3>
                  <p>swagger ui for backend documentation</p>
                </div>
                <span className="tag">pending</span>
              </article>
            </div>
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

function renderEntryGrid(entries, expandedKeys, toggleExpanded, isSaved, saveEntry, removeEntry, listKey = 'entries') {
  return (
    <div key={listKey} className="entry-list">
      {entries.map((entry) => (
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
            <button
              className="inline-button"
              type="button"
              onClick={(event) => handleActionClick(event, () => (isSaved(entry.key) ? removeEntry(entry.key) : saveEntry(entry)))}
            >
              {isSaved(entry.key) ? 'remove' : 'save'}
            </button>
            <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer" onClick={stopTogglePropagation}>
              open
            </a>
          </div>
        </article>
      ))}
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

  return 'saved in the local terminal vault'
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
