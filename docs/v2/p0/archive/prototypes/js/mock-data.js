// Mock Data for Prototype

// Mock Twitter Accounts
const mockAccounts = [
  {
    screenName: '@elonmusk',
    displayName: 'Elon Musk',
    avatar: 'https://via.placeholder.com/64/1da1f2/ffffff?text=EM',
    status: 'online',
    lastVerified: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    extensionId: 'ext_12345',
    tabId: 'tab_67890'
  },
  {
    screenName: '@BillGates',
    displayName: 'Bill Gates',
    avatar: 'https://via.placeholder.com/64/17bf63/ffffff?text=BG',
    status: 'online',
    lastVerified: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    extensionId: 'ext_12346',
    tabId: 'tab_67891'
  },
  {
    screenName: '@sundarpichai',
    displayName: 'Sundar Pichai',
    avatar: 'https://via.placeholder.com/64/ffad1f/ffffff?text=SP',
    status: 'offline',
    lastVerified: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    extensionId: 'ext_12347',
    tabId: 'tab_67892'
  }
];

// Mock Tasks
const mockTasks = [
  // 定时任务 1
  {
    id: 'task_001',
    name: '每日推文发布',
    description: '每天早上 9 点发布一条推文',
    type: 'scheduled',
    scriptPath: 'scripts/daily-tweet.py',
    schedule: 'every 24 hours',
    parameters: {
      'target-user': 'elonmusk',
      'max-tweets': '100'
    },
    status: 'running',
    nextExecutionTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    lastExecutionTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    statistics: {
      totalExecutions: 30,
      successCount: 28,
      failureCount: 2,
      successRate: 93.3,
      averageDuration: 5.2
    }
  },
  // 即时任务 1
  {
    id: 'task_002',
    name: '推文数据抓取',
    description: '抓取指定用户的最新推文',
    type: 'immediate',
    scriptPath: 'scripts/fetch-tweets.py',
    parameters: {
      'user': 'BillGates',
      'count': '50'
    },
    status: 'idle',
    lastExecution: {
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3800).toISOString(),
      status: 'success',
      output: 'Successfully fetched 50 tweets from @BillGates\nTotal likes: 15234\nTotal retweets: 3421',
      error: null,
      duration: 3.8
    }
  },
  // 定时任务 2
  {
    id: 'task_003',
    name: '互动数据统计',
    description: '统计账号的互动数据',
    type: 'scheduled',
    scriptPath: 'scripts/stats-collector.py',
    schedule: 'every 6 hours',
    parameters: {},
    status: 'running',
    nextExecutionTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    lastExecutionTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    statistics: {
      totalExecutions: 120,
      successCount: 118,
      failureCount: 2,
      successRate: 98.3,
      averageDuration: 8.5
    }
  },
  // 即时任务 2（有失败记录）
  {
    id: 'task_004',
    name: '账号验证检查',
    description: '检查账号是否需要重新验证',
    type: 'immediate',
    scriptPath: 'scripts/verify-account.py',
    parameters: {
      'account': '@sundarpichai'
    },
    status: 'idle',
    lastExecution: {
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 30 * 60 * 1000 + 2100).toISOString(),
      status: 'failure',
      output: 'Connecting to Twitter API...\nChecking account status...',
      error: 'Error: Account @sundarpichai is offline. Cannot verify.',
      duration: 2.1
    }
  }
];

// Mock Execution History (仅定时任务)
const mockExecutionHistory = {
  'task_001': [
    {
      startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 60 * 60 * 1000 + 5200).toISOString(),
      status: 'success',
      output: 'Tweet published successfully: https://twitter.com/elonmusk/status/123456789',
      error: null,
      duration: 5.2
    },
    {
      startTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 25 * 60 * 60 * 1000 + 4800).toISOString(),
      status: 'success',
      output: 'Tweet published successfully: https://twitter.com/elonmusk/status/123456788',
      error: null,
      duration: 4.8
    },
    {
      startTime: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 49 * 60 * 60 * 1000 + 15000).toISOString(),
      status: 'failure',
      output: 'Connecting to Twitter API...\nAuthenticating...\nError occurred.',
      error: 'Error: Twitter API rate limit exceeded. Please try again later.',
      duration: 15.0
    }
  ],
  'task_003': [
    {
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 3 * 60 * 60 * 1000 + 8500).toISOString(),
      status: 'success',
      output: 'Collected stats for 3 accounts\nTotal views: 15.8B\nTotal likes: 1.2B',
      error: null,
      duration: 8.5
    }
  ]
};

// Mock Failure Log (所有任务的失败记录)
const mockFailureLog = {
  'task_001': [
    {
      startTime: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 49 * 60 * 60 * 1000 + 15000).toISOString(),
      output: 'Connecting to Twitter API...\nAuthenticating...\nError occurred.',
      error: 'Error: Twitter API rate limit exceeded. Please try again later.',
      duration: 15.0,
      taskType: 'scheduled'
    }
  ],
  'task_004': [
    {
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 30 * 60 * 1000 + 2100).toISOString(),
      output: 'Connecting to Twitter API...\nChecking account status...',
      error: 'Error: Account @sundarpichai is offline. Cannot verify.',
      duration: 2.1,
      taskType: 'immediate'
    }
  ]
};

// Mock Tweets
const mockTweets = [
  {
    id: 'tweet_001',
    accountId: '@elonmusk',
    content: 'Just launched a new feature for Tesla autopilot. The future is here! 🚗⚡',
    publishTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    views: 1250000,
    likes: 45000,
    replies: 3200,
    retweets: 8500
  },
  {
    id: 'tweet_002',
    accountId: '@elonmusk',
    content: 'Working on something exciting at SpaceX. Stay tuned! 🚀',
    publishTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    views: 980000,
    likes: 38000,
    replies: 2800,
    retweets: 6200
  },
  {
    id: 'tweet_003',
    accountId: '@BillGates',
    content: 'Climate change is the biggest challenge of our time. Here\'s what we can do about it.',
    publishTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    views: 750000,
    likes: 28000,
    replies: 1900,
    retweets: 4500
  }
];

// Mock Account Stats
const mockAccountStats = {
  '@elonmusk': {
    following: 123,
    followers: 180500000,
    blueFollowers: 45000,
    totalTweets: 28500,
    totalViews: 15000000000,
    totalLikes: 850000000,
    totalRetweets: 120000000
  },
  '@BillGates': {
    following: 274,
    followers: 62300000,
    blueFollowers: 18000,
    totalTweets: 3800,
    totalViews: 5000000000,
    totalLikes: 280000000,
    totalRetweets: 45000000
  },
  '@sundarpichai': {
    following: 89,
    followers: 8500000,
    blueFollowers: 3200,
    totalTweets: 1200,
    totalViews: 800000000,
    totalLikes: 45000000,
    totalRetweets: 8000000
  }
};

// Mock Tweet Time Distribution (last 7 days)
const mockTweetDistribution = {
  '@elonmusk': [12, 15, 8, 20, 18, 14, 16],
  '@BillGates': [2, 3, 1, 2, 4, 2, 3],
  '@sundarpichai': [1, 0, 2, 1, 1, 0, 1]
};

// Mock Task Execution Stats (last 24 hours)
const mockTaskStats = {
  total: 48,
  success: 45,
  failure: 3
};

// Mock LocalBridge Response
function mockLocalBridgeQuery() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          screenName: '@elonmusk',
          displayName: 'Elon Musk',
          avatar: 'https://via.placeholder.com/64/1da1f2/ffffff?text=EM'
        },
        {
          screenName: '@BillGates',
          displayName: 'Bill Gates',
          avatar: 'https://via.placeholder.com/64/17bf63/ffffff?text=BG'
        },
        {
          screenName: '@sundarpichai',
          displayName: 'Sundar Pichai',
          avatar: 'https://via.placeholder.com/64/ffad1f/ffffff?text=SP'
        },
        {
          screenName: '@satyanadella',
          displayName: 'Satya Nadella',
          avatar: 'https://via.placeholder.com/64/e0245e/ffffff?text=SN'
        }
      ]);
    }, 1000);
  });
}

// Mock Task Execution
function mockTaskExecution(taskId) {
  return new Promise((resolve) => {
    const duration = Math.random() * 10 + 2; // 2-12 seconds
    const success = Math.random() > 0.1; // 90% success rate

    setTimeout(() => {
      resolve({
        success,
        output: success
          ? `Task executed successfully\nProcessed 100 items\nCompleted in ${duration.toFixed(1)}s`
          : `Error: Connection timeout\nFailed after ${duration.toFixed(1)}s`,
        exitCode: success ? 0 : 1,
        duration: duration
      });
    }, duration * 1000);
  });
}

// Mock Account Status Check
function mockAccountStatusCheck(screenName) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const isOnline = Math.random() > 0.2; // 80% online rate
      resolve({
        screenName,
        status: isOnline ? 'online' : 'offline',
        lastVerified: new Date().toISOString(),
        extensionId: isOnline ? `ext_${Math.random().toString(36).substr(2, 9)}` : null,
        tabId: isOnline ? `tab_${Math.random().toString(36).substr(2, 9)}` : null
      });
    }, 500);
  });
}

// Export mock data
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mockAccounts,
    mockTasks,
    mockExecutionHistory,
    mockTweets,
    mockAccountStats,
    mockTweetDistribution,
    mockTaskStats,
    mockLocalBridgeQuery,
    mockTaskExecution,
    mockAccountStatusCheck
  };
}
