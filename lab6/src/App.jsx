import { useEffect, useState } from 'react'
import {
  STORAGE_KEYS,
  beginMalLogin,
  createEmptyResults,
  fetchSeasonalAnime,
  fetchTopManga,
  fetchViewerProfile,
  finalizeMalLogin,
  getMalClientId,
  getMalRedirectUri,
  readStoredValue,
  refreshMalSession,
  searchCatalog,
  writeStoredValue,
} from './lib/mal'

const VIEWS = [
  { id: 'discover', label: 'discover' },
  { id: 'search', label: 'search' },
  { id: 'library', label: 'library' },
  { id: 'sync', label: 'sync' },
]

export default function App() {
  const [theme, setTheme] = useState(() => readStoredValue(STORAGE_KEYS.theme, 'dark'))
  const [activeView, setActiveView] = useState('discover')
  const [library, setLibrary] = useState(() => readStoredValue(STORAGE_KEYS.library, []))
  const [libraryQuery, setLibraryQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [likedOnly, setLikedOnly] = useState(false)
  const [session, setSession] = useState(() => readStoredValue(STORAGE_KEYS.session, null))
  const [results, setResults] = useState(() => createEmptyResults())
  const [discoverStatus, setDiscoverStatus] = useState('idle')
  const [discoverMessage, setDiscoverMessage] = useState('discover_idle')
  const [searchKind, setSearchKind] = useState('anime')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchMessage, setSearchMessage] = useState('search_idle')
  const [profile, setProfile] = useState(() => readStoredValue('anilog.profile', null))
  const [syncStatus, setSyncStatus] = useState('idle')
  const [syncMessage, setSyncMessage] = useState('sign_in_with_mal_to_import_lists')

  const malClientId = getMalClientId()
  const malRedirectUri = getMalRedirectUri()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStoredValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.library, library)
  }, [library])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.session, session)
  }, [session])

  useEffect(() => {
    writeStoredValue('anilog.profile', profile)
  }, [profile])

  useEffect(() => {
    if (!malClientId) {
      return
    }

    void loadDiscover()
  }, [malClientId])

  useEffect(() => {
    void restoreSessionFromUrl()
  }, [])

  const filteredLibrary = library.filter((entry) => {
    const matchesKind = kindFilter === 'all' || entry.kind === kindFilter
    const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter
    const matchesLiked = !likedOnly || entry.liked
    const searchText = `${entry.title} ${entry.kind} ${entry.note || ''} ${entry.source}`.toLowerCase()
    const matchesQuery = !libraryQuery || searchText.includes(libraryQuery.toLowerCase())
    return matchesKind && matchesSource && matchesLiked && matchesQuery
  })

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
    setDiscoverMessage('loading_mal_discovery_feeds')

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
      setSearchStatus('idle')
      setSearchMessage('search_idle')
      return
    }

    setSearchStatus('loading')
    setSearchMessage(`searching_${searchKind}`)

    try {
      const nextResults = await searchCatalog(searchKind, searchQuery.trim())
      setSearchResults(nextResults)
      setSearchStatus('ready')
      setSearchMessage(`search_ready ${nextResults.length} results`)
    } catch (error) {
      setSearchStatus('error')
      setSearchMessage(error.message || 'search_failed')
    }
  }

  async function restoreSessionFromUrl() {
    const searchParams = new URLSearchParams(window.location.search)
    const hasAuthCallback = searchParams.has('code') || searchParams.has('error')

    if (searchParams.get('error')) {
      setSyncStatus('error')
      setSyncMessage(searchParams.get('error_description') || searchParams.get('error') || 'mal_login_failed')
      window.history.replaceState({}, '', malRedirectUri)
      return
    }

    if (hasAuthCallback) {
      setActiveView('sync')
      setSyncStatus('loading')
      setSyncMessage('exchanging_mal_authorization_code')

      try {
        const nextSession = await finalizeMalLogin(searchParams)
        setSession(nextSession)
        await loadProfile(nextSession)
        setSyncStatus('ready')
        setSyncMessage('mal_login_complete')
      } catch (error) {
        setSyncStatus('error')
        setSyncMessage(error.message || 'mal_login_failed')
      } finally {
        window.history.replaceState({}, '', malRedirectUri)
      }

      return
    }

    if (!session?.accessToken) {
      return
    }

    try {
      const nextSession = await refreshMalSession(session)
      if (nextSession !== session) {
        setSession(nextSession)
      }
      await loadProfile(nextSession)
      setSyncStatus('ready')
      setSyncMessage('cached_mal_session_restored')
    } catch (error) {
      setSession(null)
      setProfile(null)
      setSyncStatus('error')
      setSyncMessage(error.message || 'cached_mal_session_invalid')
    }
  }

  async function loadProfile(activeSession) {
    const nextProfile = await fetchViewerProfile(activeSession.accessToken)
    setProfile(nextProfile)
    return nextProfile
  }

  function handleMalLogin() {
    try {
      setSyncStatus('loading')
      setSyncMessage('redirecting_to_mal_authorization')
      beginMalLogin()
    } catch (error) {
      setSyncStatus('error')
      setSyncMessage(error.message || 'mal_login_failed')
    }
  }

  function handleLogout() {
    setSession(null)
    setProfile(null)
    setSyncStatus('idle')
    setSyncMessage('mal_session_cleared')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <section className="brand-block">
          <pre className="ascii-mark">{String.raw`   _          _ _                
  / \   _ __ (_) | ___   __ _   
 / _ \ | '_ \| | |/ _ \ / _\` |  
/ ___ \| | | | | | (_) | (_| |  
/_/   \_\_| |_|_|_|\___/ \__, |  
                         |___/   `}</pre>
          <h1 className="brand-title">AniLog Terminal</h1>
          <p className="panel-copy">MAL-powered anime and manga tracker</p>
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
            <div><dt>source</dt><dd>myanimelist</dd></div>
            <div><dt>session</dt><dd>{profile?.name || (session ? 'authenticated' : 'offline')}</dd></div>
            <div><dt>titles</dt><dd>{String(library.length).padStart(4, '0')}</dd></div>
          </dl>
        </section>
      </aside>

      <section className="workspace">
        <header className="command-bar">
          <span>{`$ anilog --view ${activeView}`}</span>
          <div className="command-actions">
            <button className="command-button" type="button" onClick={loadDiscover} disabled={!malClientId}>
              refresh
            </button>
            <button className="command-button" type="button" onClick={toggleTheme}>theme</button>
            <button className="command-button" type="button" onClick={clearLibrary}>clear library</button>
          </div>
        </header>

        <section className="status-strip">
          <span>boot: shell_ready</span>
          <span>{malClientId ? 'mal: client_ready' : 'mal: client_missing'}</span>
          <span>{`discover: ${discoverMessage}`}</span>
          <span>{`search: ${searchMessage}`}</span>
          <span>{`sync: ${syncMessage}`}</span>
          <span>{`library: ${String(library.length).padStart(4, '0')} items`}</span>
        </section>

        {activeView === 'discover' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">discover.queue</p>
                <p className="panel-copy">MAL feeds will land here next</p>
              </div>
            </div>

            <div className="split-layout">
              <section className="subpanel">
                <p className="section-title">anime.feed</p>
                {results.anime.length ? (
                  <div className="card-grid stacked-grid">
                    {results.anime.map((entry) => (
                      <article key={entry.key} className="media-card">
                        {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
                        <div>
                          <p className="card-kicker">{entry.mediaType || 'anime'}</p>
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
                ) : (
                  <p className="empty-line">
                    {malClientId
                      ? discoverStatus === 'loading'
                        ? 'loading_seasonal_anime'
                        : 'seasonal_anime_not_loaded'
                      : 'set VITE_MAL_CLIENT_ID in lab6/.env'}
                  </p>
                )}
              </section>

              <section className="subpanel">
                <p className="section-title">manga.feed</p>
                {results.manga.length ? (
                  <div className="card-grid stacked-grid">
                    {results.manga.map((entry) => (
                      <article key={entry.key} className="media-card">
                        {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
                        <div>
                          <p className="card-kicker">{entry.mediaType || 'manga'}</p>
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
                ) : (
                  <p className="empty-line">
                    {malClientId ? (discoverStatus === 'loading' ? 'loading_top_manga' : 'top_manga_not_loaded') : 'set VITE_MAL_CLIENT_ID in lab6/.env'}
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
                <p className="panel-copy">search the MAL anime or manga catalog</p>
                <div className="filter-grid compact-grid">
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
                  <button className="command-button" type="submit" disabled={!malClientId}>
                    run search
                  </button>
                </div>
              </form>
            </div>

            {searchResults.length ? (
              <div className="card-grid">
                {searchResults.map((entry) => (
                  <article key={entry.key} className="media-card">
                    {entry.image ? <img className="card-image" src={entry.image} alt="" /> : null}
                    <div>
                      <p className="card-kicker">{entry.kind}</p>
                      <h2 className="card-title">{entry.title}</h2>
                      <p className="card-copy">{truncateText(entry.synopsis, 170)}</p>
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
            ) : (
              <p className="empty-line">{malClientId ? 'run_search_to_load_results' : 'set VITE_MAL_CLIENT_ID in lab6/.env'}</p>
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

              <div className="filter-grid compact-grid">
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
                  <option value="mal">source:mal</option>
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

        {activeView === 'sync' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">sync.session</p>
                <p className="panel-copy">sign in with MyAnimeList and prepare list import</p>
              </div>
            </div>

            <div className="line-list">
              <article className="line-item">
                <div>
                  <strong>oauth config</strong>
                  <p>{malClientId ? 'client_id_loaded' : 'set VITE_MAL_CLIENT_ID in lab6/.env'}</p>
                </div>
                <span className="tag">{malClientId ? 'ready' : 'missing'}</span>
              </article>

              <article className="line-item">
                <div>
                  <strong>redirect uri</strong>
                  <p>{malRedirectUri}</p>
                </div>
                <span className="tag">pkce</span>
              </article>

              <article className="line-item profile-line-item">
                <div>
                  <strong>session</strong>
                  <p>{syncMessage}</p>
                </div>
                <div className="inline-actions">
                  <button className="inline-button" type="button" onClick={handleMalLogin} disabled={!malClientId || syncStatus === 'loading'}>
                    log in
                  </button>
                  <button className="inline-button" type="button" onClick={handleLogout} disabled={!session}>
                    log out
                  </button>
                </div>
              </article>

              {profile ? (
                <article className="line-item profile-line-item">
                  <div>
                    <strong>{profile.name}</strong>
                    <p>{`watching: ${profile.anime_statistics?.num_items_watching || 0} | completed: ${profile.anime_statistics?.num_items_completed || 0}`}</p>
                  </div>
                  <span className="tag">authenticated</span>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
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
    return 'saved from the seasonal anime feed'
  }

  if (source === 'ranking') {
    return 'saved from the top manga ranking'
  }

  if (source === 'search') {
    return 'saved from catalog search results'
  }

  if (source === 'mal') {
    return 'imported from the authenticated MAL account'
  }

  return 'saved in the local terminal vault'
}
