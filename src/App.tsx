export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <h1>TweetPilot</h1>
          <p className="muted">Platform initialization successful.</p>
        </div>

        <div className="panel compact">
          <p className="panel-title">Runtime</p>
          <div className="kv">
            <span>Platform</span>
            <strong>{window.tweetOps.runtime.platform}</strong>
          </div>
          <div className="kv">
            <span>App</span>
            <strong>{window.tweetOps.appName}</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <section className="hero">
          <div>
            <h2>Platform Host Ready</h2>
            <p className="muted">
              The Electron host and preload API are initialized. Business features will be added in
              subsequent task cards.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
