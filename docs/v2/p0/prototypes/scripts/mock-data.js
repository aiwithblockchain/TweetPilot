/**
 * TweetPilot V2 - Mock Data
 * 模拟数据，用于原型演示
 */

// ==================== 工作区数据 ====================

const mockWorkspaces = [
  {
    id: 'workspace-1',
    rootPath: '/Users/alex/Projects/tweetpilot-cli',
    accountId: 'account-1',
    hasMetadata: true,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-13'),
    lastUsedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 分钟前
  },
  {
    id: 'workspace-2',
    rootPath: '/Users/alex/Projects/ai-writer-studio',
    accountId: 'account-2',
    hasMetadata: true,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-04-10'),
    lastUsedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 小时前
  },
  {
    id: 'workspace-3',
    rootPath: '/Users/alex/Work/data-analytics-lab',
    accountId: 'account-3',
    hasMetadata: false,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-04-05'),
    lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 天前
  },
  {
    id: 'workspace-4',
    rootPath: '/Users/alex/Code/content-engine',
    accountId: 'account-4',
    hasMetadata: true,
    isAccessible: true,
    source: 'clone',
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-03-20'),
    lastUsedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 天前
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
    workspacePath: '/Users/alex/Projects/tweetpilot-cli',
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
    workspacePath: '/Users/alex/Projects/tweetpilot-cli',
    type: 'create_tweet',
    name: '生成工作区更新推文',
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
    workspacePath: '/Users/alex/Projects/tweetpilot-cli',
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
  {
    id: 'task-4',
    workspacePath: '/Users/alex/Projects/ai-writer-studio',
    type: 'create_tweet',
    name: '生成周更内容草稿',
    status: 'pending',
    config: {
      topic: 'AI 写作行业趋势',
      style: 'professional',
      count: 4,
    },
    createdAt: new Date(Date.now() - 90 * 60 * 1000),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000),
  },
  {
    id: 'task-5',
    workspacePath: '/Users/alex/Code/content-engine',
    type: 'analyze_data',
    name: '分析上周互动数据',
    status: 'completed',
    config: {
      window: '7d',
      focus: 'engagement',
    },
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
];

// ==================== 任务执行历史 ====================

const mockTaskExecutions = {
  'task-1': [
    {
      id: 'exec-1-1',
      status: 'completed',
      summary: '已完成评论抓取，共生成 6 条候选回复。',
      startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
    },
    {
      id: 'exec-1-2',
      status: 'pending_review',
      summary: '等待人工审核后投递回复。',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ],
  'task-2': [
    {
      id: 'exec-2-1',
      status: 'completed',
      summary: '生成 3 条推文草稿并保存到当前工作区。',
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
    },
  ],
  'task-3': [
    {
      id: 'exec-3-1',
      status: 'in_progress',
      summary: '正在扫描 tweet-456 评论流。',
      startedAt: new Date(Date.now() - 25 * 60 * 1000),
      endedAt: null,
    },
  ],
  'task-4': [],
  'task-5': [
    {
      id: 'exec-5-1',
      status: 'completed',
      summary: '完成 7 天互动数据聚合和基础分析。',
      startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
  ],
};

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
 * 从目录路径提取工作区名称
 * @param {string} workspacePath - 工作区路径
 * @returns {string}
 */
function getWorkspaceNameFromPath(workspacePath) {
  if (!workspacePath) return '';
  return workspacePath.split('/').filter(Boolean).pop() || workspacePath;
}

/**
 * 缩短路径显示
 * @param {string} workspacePath - 工作区路径
 * @returns {string}
 */
function compactPath(workspacePath) {
  return workspacePath.replace('/Users/alex', '~');
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
 * 搜索工作区
 * @param {string} keyword - 搜索关键词
 * @returns {Array}
 */
function searchWorkspaces(keyword) {
  if (!keyword) return mockWorkspaces;

  const lowerKeyword = keyword.toLowerCase();
  return mockWorkspaces.filter(workspace => {
    const workspaceName = getWorkspaceNameFromPath(workspace.rootPath);
    return (
      workspaceName.toLowerCase().includes(lowerKeyword) ||
      workspace.rootPath.toLowerCase().includes(lowerKeyword)
    );
  });
}

/**
 * 根据路径获取工作区
 * @param {string} workspacePath - 工作区路径
 * @returns {Object|null}
 */
function getWorkspaceByPath(workspacePath) {
  return mockWorkspaces.find(workspace => workspace.rootPath === workspacePath) || null;
}

/**
 * 获取工作区任务
 * @param {string} workspacePath - 工作区路径
 * @returns {Array}
 */
function getTasksByWorkspacePath(workspacePath) {
  return mockTasks.filter(task => task.workspacePath === workspacePath);
}

/**
 * 获取任务执行历史
 * @param {string} taskId - 任务 ID
 * @returns {Array}
 */
function getTaskExecutions(taskId) {
  return mockTaskExecutions[taskId] || [];
}

/**
 * 获取工作区绑定的 Twitter 账号
 * @param {string} workspacePath - 工作区路径
 * @returns {Object|null}
 */
function getWorkspaceTwitterAccount(workspacePath) {
  const workspace = getWorkspaceByPath(workspacePath);
  if (!workspace?.accountId) return null;
  return mockTwitterAccounts[workspace.accountId] || null;
}

/**
 * 获取工作区关联的推文数据
 * @param {string} workspacePath - 工作区路径
 * @returns {Array}
 */
function getTweetsByWorkspacePath(workspacePath) {
  const account = getWorkspaceTwitterAccount(workspacePath);
  if (!account) return [];
  return mockTweets.filter(tweet => tweet.accountId === account.id);
}

/**
 * 获取工作区关联的评论数据
 * @param {string} workspacePath - 工作区路径
 * @returns {Array}
 */
function getCommentsByWorkspacePath(workspacePath) {
  const tweetIds = new Set(getTweetsByWorkspacePath(workspacePath).map(tweet => tweet.id));
  return mockComments.filter(comment => tweetIds.has(comment.tweetId));
}

/**
 * 获取工作区关联的用户画像
 * @param {string} workspacePath - 工作区路径
 * @returns {Array}
 */
function getUserProfilesByWorkspacePath(workspacePath) {
  const authors = new Set(
    getCommentsByWorkspacePath(workspacePath).map(comment => comment.author.replace(/^@/, ''))
  );
  return mockUserProfiles.filter(profile => authors.has(profile.username));
}

// ==================== 导出 ====================

window.MockData = {
  workspaces: mockWorkspaces,
  twitterAccounts: mockTwitterAccounts,
  tasks: mockTasks,
  taskExecutions: mockTaskExecutions,
  tweets: mockTweets,
  comments: mockComments,
  userProfiles: mockUserProfiles,

  // 工具函数
  formatRelativeTime,
  formatNumber,
  getWorkspaceNameFromPath,
  compactPath,
  delay,
  searchWorkspaces,
  getWorkspaceByPath,
  getTasksByWorkspacePath,
  getTaskExecutions,
  getWorkspaceTwitterAccount,
  getTweetsByWorkspacePath,
  getCommentsByWorkspacePath,
  getUserProfilesByWorkspacePath,
};
