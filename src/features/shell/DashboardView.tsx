import { platformState } from '../../data/platformState';

type DashboardViewProps = {
  currentView: string;
};

export default function DashboardView({ currentView }: DashboardViewProps) {
  const viewTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    workspace: 'Customer Workspace',
    accounts: 'Accounts',
    instances: 'Instances',
    channels: 'Execution Channels',
    tasks: 'Tasks',
    reports: 'Reports',
    extensions: 'Extensions',
  };

  const renderContent = () => {
    switch (currentView) {
      case 'workspace': {
        const workspaces = platformState.getWorkspaces();
        return (
          <div className="panel">
            <p className="panel-title">Workspaces</p>
            {workspaces.map((ws) => (
              <div key={ws.id} className="platform-item">
                <strong>{ws.name}</strong>
                <p className="muted">{ws.description}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'accounts': {
        const accounts = platformState.getAccounts();
        return (
          <div className="panel">
            <p className="panel-title">Accounts</p>
            {accounts.map((acc) => (
              <div key={acc.id} className="platform-item">
                <strong>{acc.displayName}</strong> ({acc.handle})
                <p className="muted">Status: {acc.status}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'instances': {
        const instances = platformState.getInstances();
        return (
          <div className="panel">
            <p className="panel-title">Instances</p>
            {instances.map((inst) => (
              <div key={inst.id} className="platform-item">
                <strong>{inst.name}</strong>
                <p className="muted">Status: {inst.status}</p>
                <p className="muted">Capabilities: {inst.capabilities.join(', ')}</p>
              </div>
            ))}
          </div>
        );
      }
      case 'channels': {
        const channels = platformState.getChannels();
        return (
          <div className="panel">
            <p className="panel-title">Execution Channels</p>
            {channels.map((ch) => (
              <div key={ch.id} className="platform-item">
                <strong>{ch.name}</strong> ({ch.type})
                <p className="muted">Status: {ch.status}</p>
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <p className="muted">
            {currentView === 'dashboard'
              ? 'Platform control center. Navigate to different sections using the sidebar.'
              : `${viewTitles[currentView]} view - implementation pending in subsequent task cards.`}
          </p>
        );
    }
  };

  return (
    <main className="main">
      <section className="hero">
        <div>
          <h2>{viewTitles[currentView] || 'Dashboard'}</h2>
          {renderContent()}
        </div>
      </section>
    </main>
  );
}
