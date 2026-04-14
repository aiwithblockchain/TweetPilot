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

Object.assign(mockTwitterAccounts, {
  'account-6': {
    id: 'account-6',
    username: 'growth_daily',
    displayName: 'Growth Daily',
    avatar: '📣',
    followersCount: 7800,
    followingCount: 980,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 95 * 60 * 1000),
  },
  'account-7': {
    id: 'account-7',
    username: 'founder_notes',
    displayName: 'Founder Notes',
    avatar: '🧠',
    followersCount: 6100,
    followingCount: 430,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  'account-8': {
    id: 'account-8',
    username: 'ops_radar',
    displayName: 'Ops Radar',
    avatar: '🛰️',
    followersCount: 2900,
    followingCount: 760,
    isConnected: false,
    lastSyncAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
  },
  'account-9': {
    id: 'account-9',
    username: 'design_signal',
    displayName: 'Design Signal',
    avatar: '🎨',
    followersCount: 10400,
    followingCount: 1680,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 80 * 60 * 1000),
  },
  'account-10': {
    id: 'account-10',
    username: 'build_in_public_lab',
    displayName: 'Build In Public Lab',
    avatar: '🧪',
    followersCount: 8600,
    followingCount: 1450,
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 12 * 60 * 1000),
  },
});

mockWorkspaces.push(
  {
    id: 'workspace-5',
    rootPath: '/Users/alex/Projects/founder-notes',
    accountId: 'account-7',
    hasMetadata: true,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-01-18'),
    updatedAt: new Date('2026-04-12'),
    lastUsedAt: new Date(Date.now() - 14 * 60 * 1000),
  },
  {
    id: 'workspace-6',
    rootPath: '/Users/alex/Projects/growth-daily',
    accountId: 'account-6',
    hasMetadata: true,
    isAccessible: true,
    source: 'clone',
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-04-13'),
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'workspace-7',
    rootPath: '/Users/alex/Projects/ops-radar',
    accountId: 'account-8',
    hasMetadata: true,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-02-22'),
    updatedAt: new Date('2026-04-08'),
    lastUsedAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
  },
  {
    id: 'workspace-8',
    rootPath: '/Users/alex/Projects/design-signal',
    accountId: 'account-9',
    hasMetadata: true,
    isAccessible: true,
    source: 'clone',
    createdAt: new Date('2026-03-05'),
    updatedAt: new Date('2026-04-14'),
    lastUsedAt: new Date(Date.now() - 6 * 60 * 1000),
  },
  {
    id: 'workspace-9',
    rootPath: '/Users/alex/Projects/build-in-public-lab',
    accountId: 'account-10',
    hasMetadata: true,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-03-18'),
    updatedAt: new Date('2026-04-13'),
    lastUsedAt: new Date(Date.now() - 28 * 60 * 1000),
  },
  {
    id: 'workspace-10',
    rootPath: '/Users/alex/Sandbox/workspace-onboarding',
    accountId: null,
    hasMetadata: false,
    isAccessible: true,
    source: 'folder',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-14'),
    lastUsedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  }
);

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

mockTasks.push(
  {
    id: 'task-6',
    workspacePath: '/Users/alex/Projects/founder-notes',
    type: 'create_tweet',
    name: '生成创始人周报推文',
    status: 'pending_review',
    config: { topic: '本周迭代复盘', style: 'casual', count: 5 },
    createdAt: new Date(Date.now() - 70 * 60 * 1000),
    updatedAt: new Date(Date.now() - 50 * 60 * 1000),
  },
  {
    id: 'task-7',
    workspacePath: '/Users/alex/Projects/founder-notes',
    type: 'reply_comment',
    name: '筛选高价值讨论并回复',
    status: 'completed',
    config: { tweetId: 'tweet-7', replyStrategy: 'high_engagement', minLikes: 15 },
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 9.5 * 60 * 60 * 1000),
  },
  {
    id: 'task-8',
    workspacePath: '/Users/alex/Projects/growth-daily',
    type: 'analyze_data',
    name: '分析转化漏斗反馈',
    status: 'in_progress',
    config: { window: '14d', focus: 'conversion' },
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: 'task-9',
    workspacePath: '/Users/alex/Projects/growth-daily',
    type: 'create_tweet',
    name: '生成增长实验预告',
    status: 'pending',
    config: { topic: 'A/B 测试结论', style: 'professional', count: 4 },
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'task-10',
    workspacePath: '/Users/alex/Projects/ops-radar',
    type: 'reply_comment',
    name: '处理故障公告评论',
    status: 'failed',
    config: { tweetId: 'tweet-10', replyStrategy: 'keywords', minLikes: 0 },
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6.5 * 60 * 60 * 1000),
  },
  {
    id: 'task-11',
    workspacePath: '/Users/alex/Projects/design-signal',
    type: 'create_tweet',
    name: '生成设计拆解串文',
    status: 'completed',
    config: { topic: '设计系统演化', style: 'humorous', count: 6 },
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
  },
  {
    id: 'task-12',
    workspacePath: '/Users/alex/Projects/design-signal',
    type: 'reply_comment',
    name: '回复品牌视觉反馈',
    status: 'pending_review',
    config: { tweetId: 'tweet-13', replyStrategy: 'all', minLikes: 0 },
    createdAt: new Date(Date.now() - 95 * 60 * 1000),
    updatedAt: new Date(Date.now() - 65 * 60 * 1000),
  },
  {
    id: 'task-13',
    workspacePath: '/Users/alex/Projects/build-in-public-lab',
    type: 'create_tweet',
    name: '生成里程碑发布预告',
    status: 'pending',
    config: { topic: 'MVP 上线', style: 'casual', count: 3 },
    createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
  },
  {
    id: 'task-14',
    workspacePath: '/Users/alex/Projects/build-in-public-lab',
    type: 'analyze_data',
    name: '分析发布后用户反馈',
    status: 'completed',
    config: { window: '30d', focus: 'retention' },
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 34 * 60 * 60 * 1000),
  },
  {
    id: 'task-15',
    workspacePath: '/Users/alex/Projects/ai-writer-studio',
    type: 'reply_comment',
    name: '回复写作模板咨询',
    status: 'completed',
    config: { tweetId: 'tweet-4', replyStrategy: 'keywords', minLikes: 5 },
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 17.7 * 60 * 60 * 1000),
  }
);

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

Object.assign(mockTaskExecutions, {
  'task-6': [
    {
      id: 'exec-6-1',
      status: 'pending_review',
      summary: '已生成 5 条创始人周报草稿，等待挑选最终版本。',
      startedAt: new Date(Date.now() - 70 * 60 * 1000),
      endedAt: new Date(Date.now() - 55 * 60 * 1000),
    },
  ],
  'task-7': [
    {
      id: 'exec-7-1',
      status: 'completed',
      summary: '筛出 9 条高价值评论，已投递 4 条回复。',
      startedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 9.5 * 60 * 60 * 1000),
    },
  ],
  'task-8': [
    {
      id: 'exec-8-1',
      status: 'in_progress',
      summary: '正在聚合近 14 天注册与激活数据。',
      startedAt: new Date(Date.now() - 80 * 60 * 1000),
      endedAt: null,
    },
  ],
  'task-9': [],
  'task-10': [
    {
      id: 'exec-10-1',
      status: 'failed',
      summary: '关键字策略未命中可回复评论，执行失败。',
      startedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 6.5 * 60 * 60 * 1000),
    },
  ],
  'task-11': [
    {
      id: 'exec-11-1',
      status: 'completed',
      summary: '已生成 6 条设计拆解推文并写入草稿区。',
      startedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    },
  ],
  'task-12': [
    {
      id: 'exec-12-1',
      status: 'pending_review',
      summary: '回复建议已生成，等待设计负责人确认语气。',
      startedAt: new Date(Date.now() - 95 * 60 * 1000),
      endedAt: new Date(Date.now() - 65 * 60 * 1000),
    },
  ],
  'task-13': [],
  'task-14': [
    {
      id: 'exec-14-1',
      status: 'completed',
      summary: '已导出 30 天用户反馈摘要和留存信号。',
      startedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 34 * 60 * 60 * 1000),
    },
  ],
  'task-15': [
    {
      id: 'exec-15-1',
      status: 'completed',
      summary: '回复了 3 条关于模板套餐的咨询评论。',
      startedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 17.7 * 60 * 60 * 1000),
    },
  ],
});

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

mockTweets.push(
  {
    id: 'tweet-4',
    accountId: 'account-2',
    content: '本周我们把长文改写能力升级到了 v2，支持行业语气模板和参考资料注入。',
    author: '@ai_writer',
    likes: 142,
    retweets: 39,
    replies: 31,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-5',
    accountId: 'account-2',
    content: '你更希望 AI 帮你先写标题，还是先拉出结构提纲？',
    author: '@ai_writer',
    likes: 88,
    retweets: 14,
    replies: 42,
    createdAt: new Date(Date.now() - 27 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-6',
    accountId: 'account-4',
    content: '内容引擎新增自动分发监控页，能够按渠道追踪发布质量。',
    author: '@code_academy',
    likes: 167,
    retweets: 48,
    replies: 17,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-7',
    accountId: 'account-7',
    content: '创业第 18 周：我们终于把 onboarding 漏斗压到了 3 步以内。',
    author: '@founder_notes',
    likes: 209,
    retweets: 55,
    replies: 46,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-8',
    accountId: 'account-6',
    content: '今天分享 5 个增长试验模板，适合小团队用最低成本快速验证。',
    author: '@growth_daily',
    likes: 194,
    retweets: 73,
    replies: 38,
    createdAt: new Date(Date.now() - 150 * 60 * 1000),
  },
  {
    id: 'tweet-9',
    accountId: 'account-6',
    content: '如果你的激活率停在 22%，先别加功能，先看新用户第一天卡在哪。',
    author: '@growth_daily',
    likes: 132,
    retweets: 29,
    replies: 24,
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-10',
    accountId: 'account-8',
    content: '今晚 20:00 将进行服务窗口升级，我们会实时同步状态。',
    author: '@ops_radar',
    likes: 76,
    retweets: 18,
    replies: 11,
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
  },
  {
    id: 'tweet-11',
    accountId: 'account-9',
    content: '不是每个设计系统都需要从 token 开始，先解决协作中的命名冲突。',
    author: '@design_signal',
    likes: 254,
    retweets: 91,
    replies: 37,
    createdAt: new Date(Date.now() - 75 * 60 * 1000),
  },
  {
    id: 'tweet-12',
    accountId: 'account-10',
    content: 'Build in public 不是天天报喜，而是持续公开关键判断和代价。',
    author: '@build_in_public_lab',
    likes: 221,
    retweets: 64,
    replies: 35,
    createdAt: new Date(Date.now() - 50 * 60 * 1000),
  },
  {
    id: 'tweet-13',
    accountId: 'account-9',
    content: '我们把按钮尺寸从 5 档收敛到 3 档后，交付速度明显提升。',
    author: '@design_signal',
    likes: 118,
    retweets: 26,
    replies: 19,
    createdAt: new Date(Date.now() - 16 * 60 * 60 * 1000),
  }
);

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

mockComments.push(
  {
    id: 'comment-4',
    tweetId: 'tweet-4',
    content: '这个模板库能不能支持多语言输出？',
    author: '@user4',
    likes: 21,
    sentiment: 'neutral',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'comment-5',
    tweetId: 'tweet-5',
    content: '我更想先有一个结构提纲，再决定是不是交给 AI 展开。',
    author: '@user5',
    likes: 34,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
  },
  {
    id: 'comment-6',
    tweetId: 'tweet-7',
    content: '把 onboarding 压成 3 步这点很有启发，能展开讲讲吗？',
    author: '@user6',
    likes: 51,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 7.5 * 60 * 60 * 1000),
  },
  {
    id: 'comment-7',
    tweetId: 'tweet-8',
    content: '第 3 个实验模板非常适合我现在的增长阶段。',
    author: '@user7',
    likes: 29,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 130 * 60 * 1000),
  },
  {
    id: 'comment-8',
    tweetId: 'tweet-10',
    content: '窗口升级期间 API 是否会短暂不可用？',
    author: '@user8',
    likes: 12,
    sentiment: 'neutral',
    createdAt: new Date(Date.now() - 8.5 * 60 * 60 * 1000),
  },
  {
    id: 'comment-9',
    tweetId: 'tweet-11',
    content: '命名冲突真的比 token 不统一更先伤害协作。',
    author: '@user9',
    likes: 43,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: 'comment-10',
    tweetId: 'tweet-12',
    content: '公开关键判断这一点说得太对了，别只发结果图。',
    author: '@user10',
    likes: 38,
    sentiment: 'positive',
    createdAt: new Date(Date.now() - 35 * 60 * 1000),
  },
  {
    id: 'comment-11',
    tweetId: 'tweet-13',
    content: '从 5 档到 3 档之后，设计师会不会觉得受限？',
    author: '@user4',
    likes: 17,
    sentiment: 'neutral',
    createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000),
  }
);

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

mockUserProfiles.push(
  {
    id: 'user-4',
    username: 'user4',
    displayName: 'Localization PM',
    avatar: '🌍',
    followersCount: 2500,
    followingCount: 610,
    interactionFrequency: 8,
  },
  {
    id: 'user-5',
    username: 'user5',
    displayName: 'Content Strategist',
    avatar: '📝',
    followersCount: 4800,
    followingCount: 920,
    interactionFrequency: 11,
  },
  {
    id: 'user-6',
    username: 'user6',
    displayName: 'Solo Founder',
    avatar: '🚀',
    followersCount: 7200,
    followingCount: 540,
    interactionFrequency: 16,
  },
  {
    id: 'user-7',
    username: 'user7',
    displayName: 'Growth Analyst',
    avatar: '📈',
    followersCount: 3900,
    followingCount: 870,
    interactionFrequency: 9,
  },
  {
    id: 'user-8',
    username: 'user8',
    displayName: 'Platform Engineer',
    avatar: '🛠️',
    followersCount: 3100,
    followingCount: 460,
    interactionFrequency: 7,
  },
  {
    id: 'user-9',
    username: 'user9',
    displayName: 'Design Systems Lead',
    avatar: '🧩',
    followersCount: 9600,
    followingCount: 1130,
    interactionFrequency: 13,
  },
  {
    id: 'user-10',
    username: 'user10',
    displayName: 'Indie Hacker',
    avatar: '⚡',
    followersCount: 5400,
    followingCount: 680,
    interactionFrequency: 12,
  }
);

// ==================== 存储快照数据 ====================

const mockWorkspaceStorage = {
  '/Users/alex/Projects/tweetpilot-cli': {
    databaseMb: 1.4,
    cacheMb: 0.7,
    logMb: 0.3,
    logEntries: 182,
    lastBackupAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/ai-writer-studio': {
    databaseMb: 1.1,
    cacheMb: 0.5,
    logMb: 0.2,
    logEntries: 96,
    lastBackupAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Work/data-analytics-lab': {
    databaseMb: 0,
    cacheMb: 0,
    logMb: 0,
    logEntries: 0,
    lastBackupAt: null,
    lastImportedAt: null,
  },
  '/Users/alex/Code/content-engine': {
    databaseMb: 1.8,
    cacheMb: 0.9,
    logMb: 0.6,
    logEntries: 246,
    lastBackupAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/founder-notes': {
    databaseMb: 1.2,
    cacheMb: 0.4,
    logMb: 0.2,
    logEntries: 74,
    lastBackupAt: new Date(Date.now() - 42 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/growth-daily': {
    databaseMb: 1.7,
    cacheMb: 0.8,
    logMb: 0.3,
    logEntries: 154,
    lastBackupAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/ops-radar': {
    databaseMb: 1.5,
    cacheMb: 0.9,
    logMb: 0.5,
    logEntries: 268,
    lastBackupAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/design-signal': {
    databaseMb: 1.9,
    cacheMb: 0.6,
    logMb: 0.4,
    logEntries: 133,
    lastBackupAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Projects/build-in-public-lab': {
    databaseMb: 1.3,
    cacheMb: 0.5,
    logMb: 0.2,
    logEntries: 88,
    lastBackupAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    lastImportedAt: null,
  },
  '/Users/alex/Sandbox/workspace-onboarding': {
    databaseMb: 0,
    cacheMb: 0,
    logMb: 0,
    logEntries: 0,
    lastBackupAt: null,
    lastImportedAt: null,
  },
};

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
 * 格式化文件大小
 * @param {number} sizeMb - MB
 * @returns {string}
 */
function formatFileSize(sizeMb) {
  if (!sizeMb) return '0 MB';
  if (sizeMb < 1) return `${Math.round(sizeMb * 1024)} KB`;
  return `${sizeMb.toFixed(1)} MB`;
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
 * 获取所有 Twitter 账号
 * @returns {Array}
 */
function listTwitterAccounts() {
  return Object.values(mockTwitterAccounts);
}

/**
 * 创建 Twitter 账号
 * @param {Object} data - 账号信息
 * @returns {Object}
 */
function createTwitterAccount(data) {
  const nextId = `account-${Object.keys(mockTwitterAccounts).length + 1}`;
  const username = String(data.username || '').replace(/^@/, '').trim();
  const account = {
    id: nextId,
    username,
    displayName: data.displayName?.trim() || username,
    avatar: data.avatar || '🆕',
    followersCount: Number(data.followersCount || 0),
    followingCount: Number(data.followingCount || 0),
    isConnected: true,
    lastSyncAt: new Date(),
  };
  mockTwitterAccounts[nextId] = account;
  return account;
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

function ensureWorkspaceStorage(workspacePath) {
  if (!mockWorkspaceStorage[workspacePath]) {
    mockWorkspaceStorage[workspacePath] = {
      databaseMb: 0,
      cacheMb: 0,
      logMb: 0,
      logEntries: 0,
      lastBackupAt: null,
      lastImportedAt: null,
    };
  }
  return mockWorkspaceStorage[workspacePath];
}

/**
 * 获取工作区存储快照
 * @param {string} workspacePath - 工作区路径
 * @returns {Object}
 */
function getWorkspaceStorage(workspacePath) {
  const storage = ensureWorkspaceStorage(workspacePath);
  const totalMb = storage.databaseMb + storage.cacheMb + storage.logMb;
  return {
    ...storage,
    totalMb,
    formattedDatabaseSize: formatFileSize(storage.databaseMb),
    formattedCacheSize: formatFileSize(storage.cacheMb),
    formattedLogSize: formatFileSize(storage.logMb),
    formattedTotalSize: formatFileSize(totalMb),
  };
}

/**
 * 清理工作区缓存
 * @param {string} workspacePath - 工作区路径
 * @returns {Object}
 */
function clearWorkspaceCache(workspacePath) {
  const storage = ensureWorkspaceStorage(workspacePath);
  storage.cacheMb = 0;
  storage.logEntries = Math.max(0, storage.logEntries - 24);
  return getWorkspaceStorage(workspacePath);
}

/**
 * 导入工作区快照
 * @param {string} workspacePath - 工作区路径
 * @param {Object} snapshot - 快照内容
 * @returns {Object}
 */
function importWorkspaceSnapshot(workspacePath, snapshot) {
  const storage = ensureWorkspaceStorage(workspacePath);
  storage.databaseMb = Number(snapshot?.storage?.databaseMb ?? storage.databaseMb);
  storage.cacheMb = Number(snapshot?.storage?.cacheMb ?? storage.cacheMb);
  storage.logMb = Number(snapshot?.storage?.logMb ?? storage.logMb);
  storage.logEntries = Number(snapshot?.storage?.logEntries ?? storage.logEntries);
  storage.lastImportedAt = new Date();
  return getWorkspaceStorage(workspacePath);
}

/**
 * 记录工作区备份
 * @param {string} workspacePath - 工作区路径
 * @returns {Object}
 */
function markWorkspaceBackup(workspacePath) {
  const storage = ensureWorkspaceStorage(workspacePath);
  storage.lastBackupAt = new Date();
  return getWorkspaceStorage(workspacePath);
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
  workspaceStorage: mockWorkspaceStorage,

  // 工具函数
  formatRelativeTime,
  formatNumber,
  formatFileSize,
  getWorkspaceNameFromPath,
  compactPath,
  delay,
  searchWorkspaces,
  getWorkspaceByPath,
  listTwitterAccounts,
  createTwitterAccount,
  getTasksByWorkspacePath,
  getTaskExecutions,
  getWorkspaceTwitterAccount,
  getTweetsByWorkspacePath,
  getCommentsByWorkspacePath,
  getUserProfilesByWorkspacePath,
  getWorkspaceStorage,
  clearWorkspaceCache,
  importWorkspaceSnapshot,
  markWorkspaceBackup,
};
