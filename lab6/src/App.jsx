import { useEffect, useState } from 'react'
import { STORAGE_KEYS, createEmptyResults, readStoredValue, writeStoredValue } from './lib/mal'

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
  const [likedOnly, setLikedOnly] = useState(false)
  const [session] = useState(() => readStoredValue(STORAGE_KEYS.session, null))
  const [results] = useState(() => createEmptyResults())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStoredValue(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.library, library)
  }, [library])

  const filteredLibrary = library.filter((entry) => {
    const matchesKind = kindFilter === 'all' || entry.kind === kindFilter
    const matchesLiked = !likedOnly || entry.liked
    const searchText = `${entry.title} ${entry.kind} ${entry.note || ''}`.toLowerCase()
    const matchesQuery = !libraryQuery || searchText.includes(libraryQuery.toLowerCase())
    return matchesKind && matchesLiked && matchesQuery
  })

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  function clearLibrary() {
    setLibrary([])
    setLibraryQuery('')
    setKindFilter('all')
    setLikedOnly(false)
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
            <div><dt>session</dt><dd>{session ? 'cached' : 'offline'}</dd></div>
            <div><dt>titles</dt><dd>{String(library.length).padStart(4, '0')}</dd></div>
          </dl>
        </section>
      </aside>

      <section className="workspace">
        <header className="command-bar">
          <span>{`$ anilog --view ${activeView}`}</span>
          <div className="command-actions">
            <button className="command-button" type="button" onClick={toggleTheme}>theme</button>
            <button className="command-button" type="button" onClick={clearLibrary}>clear library</button>
          </div>
        </header>

        <section className="status-strip">
          <span>boot: shell_ready</span>
          <span>{session ? 'mal: session_cached' : 'mal: login_pending'}</span>
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
                <p className="empty-line">seasonal_anime_not_loaded</p>
              </section>

              <section className="subpanel">
                <p className="section-title">manga.feed</p>
                <p className="empty-line">top_manga_not_loaded</p>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === 'search' ? (
          <section className="panel panel-fill">
            <div className="panel-header">
              <div>
                <p className="section-title">search.shell</p>
                <p className="panel-copy">results placeholder for MAL search</p>
              </div>
            </div>

            <p className="empty-line">search_endpoint_not_connected</p>
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
                      <span className="tag">{entry.liked ? 'liked' : 'saved'}</span>
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
                <p className="panel-copy">OAuth and list import will be wired in the next stage</p>
              </div>
            </div>

            <div className="line-list">
              <article className="line-item">
                <div>
                  <strong>discover cache</strong>
                  <p>{`${results.anime.length + results.manga.length} result slots ready`}</p>
                </div>
                <span className="tag">standby</span>
              </article>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
