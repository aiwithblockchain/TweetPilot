import { platformState } from '../../data/platformState';

export default function StatusOverview() {
  const workspaces = platformState.getWorkspaces();
  const accounts = platformState.getAccounts();
  const instances = platformState.getInstances();
  const channels = platformState.getChannels();

  const onlineInstances = instances.filter((i) => i.status === 'online').length;
  const availableChannels = channels.filter((c) => c.status === 'available').length;

  return (
    <>
      <h3 className="section-title">Platform Status Overview</h3>
      <div className="status-grid">
        <div className="status-card">
          <span className="status-label">Workspaces</span>
          <strong className="status-value">{workspaces.length}</strong>
          <span className="status-badge status-ok">Active</span>
        </div>

      <div className="status-card">
        <span className="status-label">Accounts</span>
        <strong className="status-value">{accounts.length}</strong>
        <span className="status-badge status-ok">Active</span>
      </div>

      <div className="status-card">
        <span className="status-label">Instances</span>
        <strong className="status-value">{onlineInstances}/{instances.length}</strong>
        <span className="status-badge status-ok">Online</span>
      </div>

      <div className="status-card">
        <span className="status-label">Channels</span>
        <strong className="status-value">{availableChannels}/{channels.length}</strong>
        <span className={`status-badge ${availableChannels > 0 ? 'status-ok' : 'status-pending'}`}>
          {availableChannels > 0 ? 'Available' : 'Pending'}
        </span>
      </div>
      </div>
    </>
  );
}
