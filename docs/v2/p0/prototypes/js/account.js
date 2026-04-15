// Account Management

class AccountManager {
  constructor() {
    this.accounts = [];
    this.init();
  }

  init() {
    // Load accounts from storage, fall back to mock data for prototype
    this.accounts = Storage.get('accounts') || mockAccounts;

    // Start periodic status check (every 5 minutes)
    this.startStatusCheck();
  }

  async mapAccount() {
    try {
      // Show loading
      const loading = showLoading('正在查询可映射账号...');

      // Query available accounts from LocalBridge (mock)
      const availableAccounts = await mockLocalBridgeQuery();

      hideLoading();

      // Show account selection modal
      this.showAccountSelectionModal(availableAccounts);
    } catch (error) {
      hideLoading();
      showToast('查询失败: ' + error.message, 'error');
    }
  }

  showAccountSelectionModal(availableAccounts) {
    const content = document.createElement('div');
    content.innerHTML = `
      <p class="mb-md text-secondary">请选择要映射的 Twitter 账号：</p>
      <div class="grid" id="account-selection-grid"></div>
    `;

    const modal = showModal(content, '映射 Twitter 账号');

    const grid = content.querySelector('#account-selection-grid');
    availableAccounts.forEach(account => {
      const card = document.createElement('div');
      card.className = 'account-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <img src="${account.avatar}" alt="${account.displayName}" class="account-avatar">
        <div class="account-info">
          <div class="account-name">${account.displayName}</div>
          <div class="account-username">${account.screenName}</div>
        </div>
      `;

      card.onclick = async () => {
        modal.remove();
        await this.createMapping(account);
      };

      grid.appendChild(card);
    });
  }

  async createMapping(accountInfo) {
    try {
      const loading = showLoading('正在建立映射...');

      // Simulate mapping creation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create account object
      const account = {
        screenName: accountInfo.screenName,
        displayName: accountInfo.displayName,
        avatar: accountInfo.avatar,
        status: 'online',
        lastVerified: new Date().toISOString(),
        extensionId: `ext_${generateId()}`,
        tabId: `tab_${generateId()}`
      };

      // Add to accounts list
      this.accounts.push(account);
      this.saveAccounts();

      hideLoading();
      showToast('账号映射成功', 'success');

      // Trigger accounts changed event
      window.dispatchEvent(new CustomEvent('accounts-changed'));
    } catch (error) {
      hideLoading();
      showToast('映射失败: ' + error.message, 'error');
    }
  }

  async deleteAccount(screenName) {
    confirm(
      `确定要删除账号 ${screenName} 的映射吗？`,
      () => {
        this.accounts = this.accounts.filter(a => a.screenName !== screenName);
        this.saveAccounts();
        showToast('账号映射已删除', 'success');
        window.dispatchEvent(new CustomEvent('accounts-changed'));
      }
    );
  }

  async refreshAccountStatus(screenName) {
    const account = this.accounts.find(a => a.screenName === screenName);
    if (!account) return;

    account.status = 'verifying';
    window.dispatchEvent(new CustomEvent('accounts-changed'));

    try {
      const result = await mockAccountStatusCheck(screenName);
      account.status = result.status;
      account.lastVerified = result.lastVerified;
      if (result.extensionId) account.extensionId = result.extensionId;
      if (result.tabId) account.tabId = result.tabId;

      this.saveAccounts();
      window.dispatchEvent(new CustomEvent('accounts-changed'));
    } catch (error) {
      account.status = 'offline';
      this.saveAccounts();
      window.dispatchEvent(new CustomEvent('accounts-changed'));
    }
  }

  async refreshAllAccounts() {
    for (const account of this.accounts) {
      await this.refreshAccountStatus(account.screenName);
    }
  }

  async reconnectAccount(screenName) {
    // In real app, this would open browser for re-login
    // For prototype, we'll just refresh status
    showToast('正在重新建立连接...', 'info');
    await this.refreshAccountStatus(screenName);
  }

  startStatusCheck() {
    // Check status every 5 minutes
    setInterval(() => {
      this.refreshAllAccounts();
    }, 5 * 60 * 1000);

    // Also check on startup
    setTimeout(() => {
      this.refreshAllAccounts();
    }, 2000);
  }

  getAccounts() {
    return this.accounts;
  }

  getAccount(screenName) {
    return this.accounts.find(a => a.screenName === screenName);
  }

  saveAccounts() {
    Storage.set('accounts', this.accounts);
  }
}

// Initialize account manager
const accountManager = new AccountManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccountManager, accountManager };
}
