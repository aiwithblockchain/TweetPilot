import { useMemo, useState } from 'react';

type ExtensionStatus = 'online' | 'idle' | 'paused';

type ExtensionCard = {
  id: string;
  name: string;
  account: string;
  status: ExtensionStatus;
  capabilities: string[];
};

const initialExtensions: ExtensionCard[] = [
  {
    id: 'tw-ext-001',
    name: 'Scout Reader',
    account: '@alpha_ops',
    status: 'online',
    capabilities: ['Read timeline', 'Track mentions', 'Collect threads'],
  },
  {
    id: 'tw-ext-002',
    name: 'Reply Pilot',
    account: '@growth_alpha',
    status: 'idle',
    capabilities: ['Draft replies', 'Queue responses', 'Follow users'],
  },
  {
    id: 'tw-ext-003',
    name: 'Publisher One',
    account: '@brand_signal',
    status: 'paused',
    capabilities: ['Publish tweets', 'Schedule posts', 'Sync media'],
  },
];

const statusTone: Record<ExtensionStatus, string> = {
  online: 'tone-online',
  idle: 'tone-idle',
  paused: 'tone-paused',
};

const commandTemplates = [
  'Read account timeline for @brand_signal and summarize current trends.',
  'Draft a reply to the newest mention on @alpha_ops with a calm product tone.',
  'Follow ten relevant AI founders from a high-performing thread.',
  'Publish a short post recapping the top engagement signal from today.',
];

const recentRuns = [
  {
    title: 'Trend brief requested',
    detail: 'Gemma prompt prepared for Scout Reader on @alpha_ops',
    state: 'queued',
  },
  {
    title: 'Reply draft review',
    detail: 'Reply Pilot waiting for approval on @growth_alpha',
    state: 'review',
  },
  {
    title: 'Publisher sync',
    detail: 'Posting workflow paused for @brand_signal',
    state: 'paused',
  },
];

const statusCycle: ExtensionStatus[] = ['online', 'idle', 'paused'];

export default function App() {
  const [extensions, setExtensions] = useState<ExtensionCard[]>(initialExtensions);
  const [selectedId, setSelectedId] = useState<string>(initialExtensions[0].id);
  const [commandDraft, setCommandDraft] = useState<string>(commandTemplates[0]);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newAccount, setNewAccount] = useState('');

  const selectedExtension = useMemo(
    () => extensions.find((extension) => extension.id === selectedId) ?? extensions[0],
    [extensions, selectedId],
  );

  const totals = useMemo(() => {
    const online = extensions.filter((extension) => extension.status === 'online').length;
    const idle = extensions.filter((extension) => extension.status === 'idle').length;
    const paused = extensions.filter((extension) => extension.status === 'paused').length;

    return {
      total: extensions.length,
      online,
      idle,
      paused,
    };
  }, [extensions]);

  const cycleStatus = (id: string) => {
    setExtensions((current) =>
      current.map((extension) => {
        if (extension.id !== id) {
          return extension;
        }

        const currentIndex = statusCycle.indexOf(extension.status);
        const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
        return { ...extension, status: nextStatus };
      }),
    );
  };

  const addExtension = () => {
    const trimmedName = newName.trim();
    const trimmedId = newId.trim();
    const trimmedAccount = newAccount.trim();

    if (!trimmedName || !trimmedId || !trimmedAccount) {
      return;
    }

    const created: ExtensionCard = {
      id: trimmedId,
      name: trimmedName,
      account: trimmedAccount.startsWith('@') ? trimmedAccount : `@${trimmedAccount}`,
      status: 'idle',
      capabilities: ['Read timeline', 'Draft replies'],
    };

    setExtensions((current) => [created, ...current]);
    setSelectedId(created.id);
    setNewName('');
    setNewId('');
    setNewAccount('');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>TweetPilot</h1>
          <p className="muted">
            Desktop control room for Gemma orchestration, extension routing, and multi-account Twitter
            operations.
          </p>
        </div>

        <nav className="nav">
          <button className="nav-item is-active">Command Center</button>
          <button className="nav-item">Extensions</button>
          <button className="nav-item">Accounts</button>
          <button className="nav-item">Campaigns</button>
          <button className="nav-item">Run Logs</button>
          <button className="nav-item">Settings</button>
        </nav>

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
          <div className="kv">
            <span>Model</span>
            <strong>gemma4:e2b</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <section className="hero">
          <div>
            <p className="eyebrow">Operations Console</p>
            <h2>Coordinate AI prompts and browser workers from one local desktop surface.</h2>
            <p className="muted hero-copy">
              This first cut focuses on extension registration, command drafting, and operator visibility
              before wiring the real APIs.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary">New Campaign</button>
            <button className="secondary">Connect Ollama</button>
          </div>
        </section>

        <section className="grid grid-4">
          <article className="panel stat-panel">
            <p className="panel-title">Total Workers</p>
            <strong className="stat-value">{totals.total}</strong>
            <span className="muted">Extensions registered in the local registry</span>
          </article>
          <article className="panel stat-panel">
            <p className="panel-title">Online</p>
            <strong className="stat-value">{totals.online}</strong>
            <span className="badge tone-online">Ready to execute</span>
          </article>
          <article className="panel stat-panel">
            <p className="panel-title">Idle</p>
            <strong className="stat-value">{totals.idle}</strong>
            <span className="badge tone-idle">Waiting for commands</span>
          </article>
          <article className="panel stat-panel">
            <p className="panel-title">Paused</p>
            <strong className="stat-value">{totals.paused}</strong>
            <span className="badge tone-paused">Operator attention</span>
          </article>
        </section>

        <section className="layout">
          <div className="column wide">
            <article className="panel panel-accent">
              <div className="section-header">
                <div>
                  <p className="panel-title">Mission Composer</p>
                  <p className="muted">
                    Draft the prompt that will be sent to the selected extension and local model runtime.
                  </p>
                </div>
                <span className={`badge ${statusTone[selectedExtension.status]}`}>
                  {selectedExtension.status}
                </span>
              </div>

              <div className="composer-head">
                <div>
                  <h3>{selectedExtension.name}</h3>
                  <p className="muted">
                    {selectedExtension.id} · {selectedExtension.account}
                  </p>
                </div>
                <button className="secondary" onClick={() => cycleStatus(selectedExtension.id)}>
                  Cycle Status
                </button>
              </div>

              <textarea
                className="composer"
                value={commandDraft}
                onChange={(event) => setCommandDraft(event.target.value)}
              />

              <div className="prompt-list prompt-list-inline">
                {commandTemplates.map((example) => (
                  <button
                    className="prompt-card"
                    key={example}
                    onClick={() => setCommandDraft(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="panel-title">Registered Extensions</p>
                  <p className="muted">Pick a worker, inspect its binding, or rotate its execution state.</p>
                </div>
              </div>

              <div className="extension-list">
                {extensions.map((extension) => (
                  <button
                    className={`extension-card selectable ${
                      extension.id === selectedExtension.id ? 'is-selected' : ''
                    }`}
                    key={extension.id}
                    onClick={() => setSelectedId(extension.id)}
                  >
                    <div className="extension-head">
                      <div>
                        <h3>{extension.name}</h3>
                        <p className="muted">
                          {extension.id} · {extension.account}
                        </p>
                      </div>
                      <span className={`badge ${statusTone[extension.status]}`}>{extension.status}</span>
                    </div>

                    <div className="chip-row">
                      {extension.capabilities.map((capability) => (
                        <span className="chip" key={capability}>
                          {capability}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <div className="column">
            <article className="panel">
              <p className="panel-title">Selected Worker</p>
              <div className="inspector">
                <div className="inspector-block">
                  <span>Name</span>
                  <strong>{selectedExtension.name}</strong>
                </div>
                <div className="inspector-block">
                  <span>ID</span>
                  <strong>{selectedExtension.id}</strong>
                </div>
                <div className="inspector-block">
                  <span>Account</span>
                  <strong>{selectedExtension.account}</strong>
                </div>
                <div className="inspector-block">
                  <span>Status</span>
                  <strong>{selectedExtension.status}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <p className="panel-title">Register Extension</p>
              <div className="form-stack">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Thread Scout"
                  />
                </label>
                <label className="field">
                  <span>ID</span>
                  <input
                    value={newId}
                    onChange={(event) => setNewId(event.target.value)}
                    placeholder="tw-ext-004"
                  />
                </label>
                <label className="field">
                  <span>Account</span>
                  <input
                    value={newAccount}
                    onChange={(event) => setNewAccount(event.target.value)}
                    placeholder="@campaign_handle"
                  />
                </label>
                <button className="primary block" onClick={addExtension}>
                  Add Extension
                </button>
              </div>
            </article>

            <article className="panel">
              <p className="panel-title">Recent Runs</p>
              <div className="run-list">
                {recentRuns.map((run) => (
                  <div className="run-item" key={run.title}>
                    <div>
                      <strong>{run.title}</strong>
                      <p className="muted">{run.detail}</p>
                    </div>
                    <span className="mini-state">{run.state}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
