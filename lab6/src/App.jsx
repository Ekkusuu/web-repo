const VIEWS = [
  { id: 'discover', label: 'discover' },
  { id: 'library', label: 'library' },
  { id: 'sync', label: 'sync' },
]

export default function App() {
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
            <button key={item.id} className={`menu-button ${item.id === 'discover' ? 'menu-button-active' : ''}`} type="button">
              {`> ${item.label}`}
            </button>
          ))}
        </nav>

        <section className="sidebar-panel">
          <p className="section-title">status</p>
          <dl className="meta-list">
            <div><dt>theme</dt><dd>dark</dd></div>
            <div><dt>source</dt><dd>myanimelist</dd></div>
            <div><dt>session</dt><dd>offline</dd></div>
          </dl>
        </section>
      </aside>

      <section className="workspace">
        <header className="command-bar">
          <span>$ anilog --view discover</span>
          <div className="command-actions">
            <button className="command-button" type="button">refresh</button>
            <button className="command-button" type="button">theme</button>
          </div>
        </header>

        <section className="status-strip">
          <span>boot: shell_ready</span>
          <span>mal: client_not_configured</span>
          <span>library: 0000 items</span>
        </section>

        <section className="panel panel-fill">
          <div className="panel-header">
            <div>
              <p className="section-title">discover.boot</p>
              <p className="panel-copy">fresh rebuild started from scratch</p>
            </div>
          </div>

          <div className="line-list">
            <article className="line-item">
              <div>
                <strong>next steps</strong>
                <p>wire MAL auth, live data, local library actions, and filters</p>
              </div>
              <span className="tag">pending</span>
            </article>
          </div>
        </section>
      </section>
    </main>
  )
}
