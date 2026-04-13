/**
 * TweetPilot V2 - Mock Data
 * 模拟数据，用于原型演示
 */

// ==================== 产品数据 ====================

const mockProducts = [
  {
    id: 'product-1',
    name: '我的 SaaS 产品',
    description: '一个很棒的 SaaS 产品，帮助用户提高生产力',
    icon: '📦',
    twitterAccountId: 'account-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-13'),
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 小时前
  },
  {
    id: 'product-2',
    name: 'AI 写作助手',
    description: '基于 AI 的智能写作工具',
    icon: '✍️',
    twitterAccountId: 'account-2',
    createdAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-04-10'),
    lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前
  },
  {
    id: 'product-3',
    name: '数据分析平台',
    description: '企业级数据分析和可视化平台',
    icon: '📊',
    twitterAccountId: 'account-3',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-04-05'),
    lastUsedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 天前
  },
  {
    id: 'product-4',
    name: '在线教育平台',
    description: '面向开发者的在线编程教育平台',
    icon: '🎓',
    twitterAccountId: 'account-4',
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-03-20'),
    lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 天前
  },
  {
    id: 'product-5',
    name: '项目管理工具',
    description: '敏捷团队的项目管理和协作工具',
    icon: '📋',
    twitterAccountId: 'account-5',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-02-28'),
    lastUsedAt: new Date('2026-02-28'),
  },
];

// ==================== Twitter 账号数据 ====================

const mockTwitterAccounts = {
  'account-1': {
    id: 'account-1',
    username: 'my_saas',
    displayName: 'My SaaS Product',
    avatar: '👤',
    followersCount: 5600,
    followingCount: 1200,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 30 * 60 * 1000), // 30 分钟前
  },
  'account-2': {
    id: 'account-2',
    username: 'ai_writer',
    displayName: 'AI Writer Assistant',
    avatar: '🤖',
    followersCount: 3400,
    followingCount: 890,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 小时前
  },
  'account-3': {
    id: 'account-3',
    username: 'data_platform',
    displayName: 'Data Analytics Platform',
    avatar: '📈',
    followersCount: 8900,
    followingCount: 2100,
    isConnected: false,
    lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前
  },
  'account-4': {
    id: 'account-4',
    username: 'code_academy',
    displayName: 'Code Academy Online',
    avatar: '💻',
    followersCount: 12000,
    followingCount: 3500,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 5 * 60 * 1000), // 5 分钟前
  },
  'account-5': {
    id: 'account-5',
    username: 'project_mgmt',
    displayName: 'Project Management Tool',
    avatar: '📌',
    followersCount: 4200,
    followingCount: 1500,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 60 * 60 * 1000), // 1 小时前
  },
};

// ==================== 任务数据 ====================

const mockTasks = [
  {
    id: 'task-1',
    productId: 'product-1',
    type: 'reply_comment',
    name: '自动回复评论',
    status: 'pending_review',
    config: {
      tweetId: 'tweet-123',
      replyStrategy: 'high_engagement',
      minLikes: 10,
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 小时前
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'task-2',
    productId: 'product-1',
    type: 'create_tweet',
    name: '生成产品更新推文',
    status: 'completed',
    config: {
      topic: '新功能发布',
      style: 'professional',
      count: 3,
    },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前
    updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
  },
  {
    id: 'task-3',
    productId: 'product-1',
    type: 'reply_comment',
    name: '回复用户反馈',
    status: 'in_progress',
    config: {
      tweetId: 'tweet-456',
      replyStrategy: 'all',
    },
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 分钟前
    updatedAt: new Date(Date.now() - 10 * 60 * 1000),
  },
];

// ==================== 推文数据 ====================

const mockTweets = [
  {
    id: 'tweet-1',
    accountId: 'account-1',
    content: '我们发布了新功能！现在支持实时协作和智能推荐，快来体验吧 🚀',
    author: '@my_saas',
    likes: 123,
    retweets: 45,
    replies: 28,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 小时前
  },
  {
    id: 'tweet-2',
    accountId: 'account-1',
    content: '感谢大家的支持！我们的用户数突破 10,000 了 🎉',
    author: '@my_saas',
    likes: 98,
    retweets: 32,
    replies: 15,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前
  },
  {
    id: 'tweet-3',
    accountId: 'account-1',
    content: '今天的更新：修复了几个 bug，优化了性能，体验更流畅了 ✨',
    author: '@my_saas',
    likes: 87,
    retweets: 21,
    replies: 12,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 天前
  },
];

// ==================== 评论数据 ====================

const mockComments = [
  {
    id: 'comment-1',
    tweetId: 'tweet-1',
    content: '这个功能太棒了！正是我需要的 👍',
    author: '@user1',
    likes: 45,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 小时前
  },
  {
    id: 'comment-2',
    tweetId: 'tweet-1',
    content: '什么时候支持移动端？期待中...',
    author: '@user2',
    likes: 32,
    sentiment: 'neutral',
    createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 小时前
  },
  {
    id: 'comment-3',
    tweetId: 'tweet-1',
    content: '有个小问题：导出功能好像有 bug',
    author: '@user3',
    likes: 28,
    sentiment: 'negative',
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 分钟前
  },
];

// ==================== 用户画像数据 ====================

const mockUserProfiles = [
  {
    id: 'user-1',
    username: 'user1',
    displayName: 'Tech Enthusiast',
    avatar: '👨‍💻',
    followersCount: 5600,
    followingCount: 1200,
    interactionFrequency: 15, // 每周互动次数
  },
  {
    id: 'user-2',
    username: 'user2',
    displayName: 'Product Manager',
    avatar: '👩‍💼',
    followersCount: 3400,
    followingCount: 890,
    interactionFrequency: 12,
  },
  {
    id: 'user-3',
    username: 'user3',
    displayName: 'Developer',
    avatar: '🧑‍💻',
    followersCount: 8900,
    followingCount: 2100,
    interactionFrequency: 10,
  },
];

// ==================== 工具函数 ====================

/**
 * 格式化时间为相对时间
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的相对时间
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

/**
 * 格式化数字（添加千位分隔符）
 * @param {number} num - 数字
 * @returns {string} - 格式化后的数字
 */
function formatNumber(num) {
  return num.toLocaleString('zh-CN');
}

/**
 * 模拟 API 延迟
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 搜索产品
 * @param {string} keyword - 搜索关键词
 * @returns {Array} - 匹配的产品列表
 */
function searchProducts(keyword) {
  if (!keyword) return mockProducts;

  const lowerKeyword = keyword.toLowerCase();
  return mockProducts.filter(product => {
    const account = mockTwitterAccounts[product.twitterAccountId];
    return (
      product.name.toLowerCase().includes(lowerKeyword) ||
      product.description?.toLowerCase().includes(lowerKeyword) ||
      account.username.toLowerCase().includes(lowerKeyword) ||
      account.displayName.toLowerCase().includes(lowerKeyword)
    );
  });
}

/**
 * 获取产品的 Twitter 账号信息
 * @param {string} productId - 产品 ID
 * @returns {Object|null} - Twitter 账号信息
 */
function getProductTwitterAccount(productId) {
  const product = mockProducts.find(p => p.id === productId);
  if (!product) return null;
  return mockTwitterAccounts[product.twitterAccountId];
}

// ==================== 导出 ====================

window.MockData = {
  products: mockProducts,
  twitterAccounts: mockTwitterAccounts,
  tasks: mockTasks,
  tweets: mockTweets,
  comments: mockComments,
  userProfiles: mockUserProfiles,

  // 工具函数
  formatRelativeTime,
  formatNumber,
  delay,
  searchProducts,
  getProductTwitterAccount,
};
