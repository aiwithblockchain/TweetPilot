// Workspace Management

class WorkspaceManager {
  constructor() {
    this.currentWorkspace = null;
    this.recentWorkspaces = [];
    this.init();
  }

  init() {
    // Load current workspace
    this.currentWorkspace = Storage.getGlobal('current-workspace');

    // Load recent workspaces
    this.recentWorkspaces = Storage.getGlobal('recent-workspaces') || [];
  }

  setCurrentWorkspace(path) {
    this.currentWorkspace = path;
    Storage.setGlobal('current-workspace', path);

    // Add to recent workspaces
    this.addToRecent(path);

    // Trigger workspace change event
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { path } }));
  }

  addToRecent(path) {
    // Remove if already exists
    this.recentWorkspaces = this.recentWorkspaces.filter(w => w.path !== path);

    // Add to beginning
    this.recentWorkspaces.unshift({
      path: path,
      name: path.split('/').pop(),
      lastAccessed: new Date().toISOString()
    });

    // Keep only last 10
    this.recentWorkspaces = this.recentWorkspaces.slice(0, 10);

    // Save
    Storage.setGlobal('recent-workspaces', this.recentWorkspaces);
  }

  getRecentWorkspaces() {
    return this.recentWorkspaces;
  }

  getCurrentWorkspace() {
    return this.currentWorkspace;
  }

  // Simulate opening new instance
  openNewInstance(path) {
    // In real Electron app, this would spawn a new process
    // For prototype, we'll open in a new tab
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', path);
    window.open(url.toString(), '_blank');
  }

  // Simulate file picker
  async selectLocalDirectory() {
    return new Promise((resolve) => {
      const path = prompt('请输入工作目录路径:', '/Users/user/projects/my-project');
      if (path) {
        resolve(path);
      } else {
        resolve(null);
      }
    });
  }

  // Simulate GitHub clone
  async cloneFromGitHub(url, localPath) {
    return new Promise((resolve, reject) => {
      // Show loading
      const loading = showLoading('正在克隆仓库...');

      // Simulate clone process
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          hideLoading();

          // Simulate success
          if (Math.random() > 0.1) {
            showToast('克隆成功', 'success');
            resolve(localPath);
          } else {
            showToast('克隆失败', 'error');
            reject(new Error('Clone failed'));
          }
        }
      }, 300);
    });
  }
}

// Initialize workspace manager
const workspaceManager = new WorkspaceManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkspaceManager, workspaceManager };
}
