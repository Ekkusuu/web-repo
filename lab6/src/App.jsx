import { useEffect, useState } from 'react'
import {
  STORAGE_KEYS,
  createEmptyResults,
  fetchSeasonalAnime,
  fetchTopManga,
  readStoredValue,
  searchCatalog,
  writeStoredValue,
} from './lib/mal'

const VIEWS = [
  { id: 'discover', label: 'discover' },
  { id: 'search', label: 'search' },
  { id: 'library', label: 'library' },
  { id: 'source', label: 'source' },
]

const ASCII_MARK = [
  '   _          _ _                ',
  '  / \\   _ __ (_) | ___   __ _   ',
  ' / _ \\ | \'_ \\| | |/ _ \\ / _` |  ',
  '/ ___ \\| | | | | | (_) | (_| |  ',
  '/_/   \\_\\_| |_|_|_|\\___/ \\__, |  ',
  '                         |___/   ',
].join('\n')

export default function App() {
  const [theme, setTheme] = useState(() => readStoredValue(STORAGE_KEYS.theme, 'dark'))
  const [activeView, setActiveView] = useState('discover')
  const [library, setLibrary] = useState(() => readStoredValue(STORAGE_KEYS.library, []))
  const [libraryQuery, setLibraryQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [likedOnly, setLikedOnly] = useState(false)
  const [results, setResults] = useState(() => createEmptyResults())
  const [discoverStatus, setDiscoverStatus] = useState('idle')
  const [discoverMessage, setDiscoverMessage] = useState('discover_idle')
  const [searchKind, setSearchKind] = useState('anime')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMessage, setSearchMessage] = useState('search_idle')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStoredValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.library, library)
  }, [library])

  useEffect(() => {
    void loadDiscover()
  }, [])

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

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function clearLibrary() {
    setLibrary([])
    setLibraryQuery('')
    setKindFilter('all')
    setSourceFilter('all')
    setLikedOnly(false)
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
      const [anime, manga] = await Promise.all([fetchSeasonalAnime(), fetchTopManga()])
      setResults({ anime, manga })
      setDiscoverStatus('ready')
      setDiscoverMessage(`discover_ready ${anime.length} anime ${manga.length} manga`)
    } catch (error) {
      setDiscoverStatus('error')
      setDiscoverMessage(error.message || 'discover_failed')
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
      setSearchResults(nextResults)
      setSearchMessage(`search_ready ${nextResults.length} results`)
    } catch (error) {
      setSearchMessage(error.message || 'search_failed')
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <section className="brand-block">
          <pre className="ascii-mark">{ASCII_MARK}</pre>
          <h1 className="brand-title">AniLog Terminal</h1>
          <p className="panel-copy">public anime and manga discovery vault</p>
        </section>

        <nav className="menu-list" aria-label="Views">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              className={`menu-button ${item.id === activeView ? 'menu-button-active' : ''}`}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              {`> ${item.label}`}
            </button>
          ))}
        </nav>

        <section className="sidebar-panel">
          <p className="section-title">status</p>
          <dl className="meta-list">
            <div><dt>theme</dt><dd>{theme}</dd></div>
            <div><dt>source</dt><dd>jikan_public_api</dd></div>
            <div><dt>session</dt><dd>none</dd></div>
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
          <span>{`$ anilog --view ${activeView}`}</span>
          <div className="command-actions">
            <button className="command-button" type="button" onClick={loadDiscover}>
              refresh
            </button>
            <button className="command-button" type="button" onClick={toggleTheme}>theme</button>
            <button className="command-button" type="button" onClick={clearLibrary}>clear library</button>
          </div>
        </header>

        <section className="status-strip">
          <span>boot: shell_ready</span>
          <span>{`discover: ${discoverMessage}`}</span>
          <span>{`search: ${searchMessage}`}</span>
          <span>{`library: ${String(library.length).padStart(4, '0')} items`}</span>
        </section>

        {activeView === 'discover' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">discover.queue</p>
                <p className="panel-copy">current season anime and top manga from a public API</p>
              </div>
            </div>

            <div className="split-layout">
              <section className="subpanel">
                <p className="section-title">anime.feed</p>
                {results.anime.length ? renderEntryGrid(results.anime, isSaved, saveEntry, removeEntry) : (
                  <p className="empty-line">
                    {discoverStatus === 'loading' ? 'loading_seasonal_anime' : 'seasonal_anime_not_loaded'}
                  </p>
                )}
              </section>

              <section className="subpanel">
                <p className="section-title">manga.feed</p>
                {results.manga.length ? renderEntryGrid(results.manga, isSaved, saveEntry, removeEntry) : (
                  <p className="empty-line">
                    {discoverStatus === 'loading' ? 'loading_top_manga' : 'top_manga_not_loaded'}
                  </p>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {activeView === 'search' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <form className="search-form" onSubmit={handleSearch}>
                <p className="section-title">search.shell</p>
                <p className="panel-copy">search the public anime or manga catalog</p>
                <div className="filter-grid compact-grid search-grid">
                  <input
                    className="field"
                    type="search"
                    placeholder="search title"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  <select className="field" value={searchKind} onChange={(event) => setSearchKind(event.target.value)}>
                    <option value="anime">kind:anime</option>
                    <option value="manga">kind:manga</option>
                  </select>
                  <button className="command-button" type="submit">
                    run search
                  </button>
                </div>
              </form>
            </div>

            {searchResults.length ? renderEntryGrid(searchResults, isSaved, saveEntry, removeEntry) : (
              <p className="empty-line">run_search_to_load_results</p>
            )}
          </section>
        ) : null}

        {activeView === 'library' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">library.vault</p>
                <p className="panel-copy">local runtime state with browser persistence</p>
              </div>

              <div className="filter-grid compact-grid library-grid">
                <input
                  className="field"
                  type="search"
                  placeholder="grep title note"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                />
                <select className="field" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
                  <option value="all">kind:all</option>
                  <option value="anime">kind:anime</option>
                  <option value="manga">kind:manga</option>
                </select>
                <select className="field" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  <option value="all">source:all</option>
                  <option value="seasonal">source:seasonal</option>
                  <option value="ranking">source:ranking</option>
                  <option value="search">source:search</option>
                </select>
                <button className="command-button" type="button" onClick={() => setLikedOnly((current) => !current)}>
                  {likedOnly ? 'liked:on' : 'liked:off'}
                </button>
              </div>
            </div>

            {filteredLibrary.length ? (
              <div className="card-grid">
                {filteredLibrary.map((entry) => (
                  <article key={entry.key} className="media-card">
                    <div>
                      <p className="card-kicker">{entry.kind}</p>
                      <h2 className="card-title">{entry.title}</h2>
                      <p className="card-copy">{entry.note || 'local entry saved in browser storage'}</p>
                    </div>
                    <div className="inline-actions">
                      <span className="tag">{entry.source}</span>
                      <button className="inline-button" type="button" onClick={() => toggleLike(entry.key)}>
                        {entry.liked ? 'unlike' : 'like'}
                      </button>
                      <button className="inline-button" type="button" onClick={() => removeEntry(entry.key)}>
                        remove
                      </button>
                      <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer">
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

        {activeView === 'source' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">source.status</p>
                <p className="panel-copy">public data mode only, with no account login or remote user state</p>
              </div>
            </div>

            <div className="line-list">
              <article className="line-item">
                <div>
                  <strong>api mode</strong>
                  <p>jikan public endpoints with no auth required</p>
                </div>
                <span className="tag">public</span>
              </article>
              <article className="line-item">
                <div>
                  <strong>app state</strong>
                  <p>all saved titles, filters, and likes are stored locally in the browser</p>
                </div>
                <span className="tag">local</span>
              </article>
              <article className="line-item">
                <div>
                  <strong>catalog links</strong>
                  <p>entries open their original MyAnimeList detail pages in a new tab</p>
                </div>
                <span className="tag">mal</span>
              </article>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}

function renderEntryGrid(entries, isSaved, saveEntry, removeEntry) {
  return (
    <div className="card-grid stacked-grid">
      {entries.map((entry) => (
        <article key={entry.key} className="media-card">
          {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
          <div>
            <p className="card-kicker">{entry.mediaType || entry.kind}</p>
            <h2 className="card-title">{entry.title}</h2>
            <p className="card-copy">{truncateText(entry.synopsis, 160)}</p>
          </div>
          <div className="inline-actions">
            <span className="tag">{entry.score ? `score:${entry.score}` : 'score:na'}</span>
            <button
              className="inline-button"
              type="button"
              onClick={() => (isSaved(entry.key) ? removeEntry(entry.key) : saveEntry(entry))}
            >
              {isSaved(entry.key) ? 'remove' : 'save'}
            </button>
            <a className="inline-link" href={entry.url} target="_blank" rel="noreferrer">
              open
            </a>
          </div>
        </article>
      ))}
    </div>
  )
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

  if (source === 'search') {
    return 'saved from catalog search results'
  }

  return 'saved in the local terminal vault'
}
