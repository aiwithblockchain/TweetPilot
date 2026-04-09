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

  return (
    <main className="main">
      <section className="hero">
        <div>
          <h2>{viewTitles[currentView] || 'Dashboard'}</h2>
          <p className="muted">
            {currentView === 'dashboard'
              ? 'Platform control center. Navigate to different sections using the sidebar.'
              : `${viewTitles[currentView]} view - implementation pending in subsequent task cards.`}
          </p>
        </div>
      </section>
    </main>
  );
}
