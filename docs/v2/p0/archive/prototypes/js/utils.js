// Utility Functions

// Date Formatting
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return '刚刚';
}

// Storage Management
class Storage {
  static get(key) {
    const workspace = localStorage.getItem('current-workspace');
    if (!workspace) return null;
    const fullKey = `${workspace}/${key}`;
    const value = localStorage.getItem(fullKey);
    return value ? JSON.parse(value) : null;
  }

  static set(key, value) {
    const workspace = localStorage.getItem('current-workspace');
    if (!workspace) {
      console.error('No workspace selected');
      return;
    }
    const fullKey = `${workspace}/${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  }

  static remove(key) {
    const workspace = localStorage.getItem('current-workspace');
    if (!workspace) return;
    const fullKey = `${workspace}/${key}`;
    localStorage.removeItem(fullKey);
  }

  static getGlobal(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  static setGlobal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// UUID Generator
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Modal Management
function showModal(content, title = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const contentEl = document.createElement('div');
  contentEl.className = 'modal-content';
  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else {
    contentEl.appendChild(content);
  }

  modal.appendChild(header);
  modal.appendChild(contentEl);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  return overlay;
}

// Confirm Dialog
function confirm(message, onConfirm, onCancel) {
  const content = document.createElement('div');
  content.innerHTML = `
    <p class="mb-lg">${message}</p>
    <div class="form-actions">
      <button class="secondary" id="cancel-btn">取消</button>
      <button class="danger" id="confirm-btn">确认</button>
    </div>
  `;

  const modal = showModal(content, '确认操作');

  content.querySelector('#confirm-btn').onclick = () => {
    modal.remove();
    if (onConfirm) onConfirm();
  };

  content.querySelector('#cancel-btn').onclick = () => {
    modal.remove();
    if (onCancel) onCancel();
  };
}

// Toast Notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background-color: ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : 'var(--color-primary)'};
    color: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Loading Indicator
function showLoading(message = '加载中...') {
  const loading = document.createElement('div');
  loading.id = 'global-loading';
  loading.className = 'modal-overlay';
  loading.innerHTML = `
    <div style="text-align: center; color: white;">
      <div class="spinner" style="margin: 0 auto 16px;"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(loading);
  return loading;
}

function hideLoading() {
  const loading = document.getElementById('global-loading');
  if (loading) loading.remove();
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Router
class Router {
  static navigate(page) {
    window.location.hash = page;
  }

  static getCurrentPage() {
    return window.location.hash.slice(1) || 'workspace-selector';
  }

  static init(routes) {
    window.addEventListener('hashchange', () => {
      const page = this.getCurrentPage();
      if (routes[page]) {
        routes[page]();
      }
    });

    // Initial load
    const page = this.getCurrentPage();
    if (routes[page]) {
      routes[page]();
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDate,
    formatRelativeTime,
    Storage,
    generateId,
    showModal,
    confirm,
    showToast,
    showLoading,
    hideLoading,
    debounce,
    Router
  };
}
