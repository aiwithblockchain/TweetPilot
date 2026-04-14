// Data Blocks Management

class DataBlocksManager {
  constructor() {
    this.cards = [];
    this.cardTypes = [
      {
        id: 'account_tweet_stats',
        name: '账号推文统计',
        description: '显示每个账号的推文总数'
      },
      {
        id: 'latest_tweets',
        name: '最新推文列表',
        description: '显示账号最新的 10 条推文'
      },
      {
        id: 'account_basic_data',
        name: '账号基础数据',
        description: '显示关注数、被关注数等基础信息'
      },
      {
        id: 'account_interaction_data',
        name: '账号互动数据',
        description: '显示总浏览量、点赞数、转推数'
      },
      {
        id: 'tweet_time_distribution',
        name: '推文时间分布',
        description: '显示最近 7 天的推文发布数量'
      },
      {
        id: 'task_execution_stats',
        name: '任务执行统计',
        description: '显示最近 24 小时的任务执行情况'
      }
    ];
    this.init();
  }

  init() {
    // Load cards from storage
    this.cards = Storage.get('data-blocks-layout') || [];
  }

  addCard(typeId, config = {}) {
    const type = this.cardTypes.find(t => t.id === typeId);
    if (!type) return;

    const card = {
      id: generateId(),
      type: typeId,
      position: this.cards.length,
      config: config,
      lastUpdated: new Date().toISOString()
    };

    this.cards.push(card);
    this.saveCards();
    window.dispatchEvent(new CustomEvent('cards-changed'));

    return card;
  }

  removeCard(cardId) {
    this.cards = this.cards.filter(c => c.id !== cardId);
    // Reorder positions
    this.cards.forEach((card, index) => {
      card.position = index;
    });
    this.saveCards();
    window.dispatchEvent(new CustomEvent('cards-changed'));
  }

  updateCard(cardId, updates) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    Object.assign(card, updates);
    card.lastUpdated = new Date().toISOString();
    this.saveCards();
    window.dispatchEvent(new CustomEvent('cards-changed'));
  }

  refreshCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    card.lastUpdated = new Date().toISOString();
    this.saveCards();
    window.dispatchEvent(new CustomEvent('card-refreshed', { detail: { cardId } }));
  }

  moveCard(cardId, newPosition) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    const oldPosition = card.position;

    // Remove from old position
    this.cards.splice(oldPosition, 1);

    // Insert at new position
    this.cards.splice(newPosition, 0, card);

    // Update all positions
    this.cards.forEach((c, index) => {
      c.position = index;
    });

    this.saveCards();
    window.dispatchEvent(new CustomEvent('cards-changed'));
  }

  getCards() {
    return this.cards.sort((a, b) => a.position - b.position);
  }

  getCardTypes() {
    return this.cardTypes;
  }

  getCardData(card) {
    switch (card.type) {
      case 'account_tweet_stats':
        return this.getAccountTweetStats();
      case 'latest_tweets':
        return this.getLatestTweets(card.config.accountId);
      case 'account_basic_data':
        return this.getAccountBasicData(card.config.accountId);
      case 'account_interaction_data':
        return this.getAccountInteractionData(card.config.accountId);
      case 'tweet_time_distribution':
        return this.getTweetTimeDistribution(card.config.accountId);
      case 'task_execution_stats':
        return this.getTaskExecutionStats();
      default:
        return null;
    }
  }

  getAccountTweetStats() {
    const accounts = accountManager.getAccounts();
    return accounts.map(account => ({
      screenName: account.screenName,
      displayName: account.displayName,
      avatar: account.avatar,
      tweetCount: mockAccountStats[account.screenName]?.totalTweets || 0
    }));
  }

  getLatestTweets(accountId) {
    if (!accountId) {
      const accounts = accountManager.getAccounts();
      accountId = accounts[0]?.screenName;
    }
    return mockTweets.filter(t => t.accountId === accountId).slice(0, 10);
  }

  getAccountBasicData(accountId) {
    if (!accountId) {
      const accounts = accountManager.getAccounts();
      accountId = accounts[0]?.screenName;
    }
    return mockAccountStats[accountId] || null;
  }

  getAccountInteractionData(accountId) {
    if (!accountId) {
      const accounts = accountManager.getAccounts();
      accountId = accounts[0]?.screenName;
    }
    const stats = mockAccountStats[accountId];
    if (!stats) return null;

    return {
      totalViews: stats.totalViews,
      totalLikes: stats.totalLikes,
      totalRetweets: stats.totalRetweets
    };
  }

  getTweetTimeDistribution(accountId) {
    if (!accountId) {
      const accounts = accountManager.getAccounts();
      accountId = accounts[0]?.screenName;
    }
    return mockTweetDistribution[accountId] || [];
  }

  getTaskExecutionStats() {
    return mockTaskStats;
  }

  saveCards() {
    Storage.set('data-blocks-layout', this.cards);
  }
}

// Chart rendering utilities
class ChartRenderer {
  static renderBarChart(canvas, data, labels) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const barWidth = (width - padding * 2) / data.length;
    const maxValue = Math.max(...data);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw bars
    data.forEach((value, index) => {
      const barHeight = (value / maxValue) * (height - padding * 2);
      const x = padding + index * barWidth;
      const y = height - padding - barHeight;

      ctx.fillStyle = '#1da1f2';
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

      // Draw label
      ctx.fillStyle = '#657786';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);

      // Draw value
      ctx.fillStyle = '#14171a';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });
  }

  static renderPieChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    const total = data.success + data.failure;
    const successAngle = (data.success / total) * 2 * Math.PI;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw success slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, 0, successAngle);
    ctx.closePath();
    ctx.fillStyle = '#17bf63';
    ctx.fill();

    // Draw failure slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, successAngle, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#e0245e';
    ctx.fill();

    // Draw center circle (donut effect)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#14171a';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const successRate = ((data.success / total) * 100).toFixed(1);
    ctx.fillText(`${successRate}%`, centerX, centerY);

    // Draw legend
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';

    // Success legend
    ctx.fillStyle = '#17bf63';
    ctx.fillRect(20, height - 40, 15, 15);
    ctx.fillStyle = '#14171a';
    ctx.fillText(`成功: ${data.success}`, 40, height - 30);

    // Failure legend
    ctx.fillStyle = '#e0245e';
    ctx.fillRect(150, height - 40, 15, 15);
    ctx.fillStyle = '#14171a';
    ctx.fillText(`失败: ${data.failure}`, 170, height - 30);
  }
}

// Initialize data blocks manager
const dataBlocksManager = new DataBlocksManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataBlocksManager, ChartRenderer, dataBlocksManager };
}
