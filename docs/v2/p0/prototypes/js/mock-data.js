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
  {
    id: 'task_001',
    name: '每日推文发布',
    description: '每天早上 9 点发布一条推文',
    type: 'scheduled',
    scriptPath: 'daily-tweet.py',
    schedule: '0 9 * * *',
    parameters: {
      'target-user': 'elonmusk',
      'max-tweets': '100'
    },
    status: 'running',
    nextExecutionTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    lastExecutionTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    statistics: {
      totalExecutions: 30,
      successCount: 28,
      failureCount: 2,
      successRate: 93.3,
      averageDuration: 5.2
    }
  },
  {
    id: 'task_002',
    name: '推文数据抓取',
    description: '抓取指定用户的最新推文',
    type: 'immediate',
    scriptPath: 'fetch-tweets.py',
    schedule: null,
    parameters: {
      'user': 'BillGates',
      'count': '50'
    },
    status: 'paused',
    nextExecutionTime: null,
    lastExecutionTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    statistics: {
      totalExecutions: 15,
      successCount: 15,
      failureCount: 0,
      successRate: 100,
      averageDuration: 3.8
    }
  },
  {
    id: 'task_003',
    name: '互动数据统计',
    description: '统计账号的互动数据',
    type: 'scheduled',
    scriptPath: 'stats-collector.py',
    schedule: '0 */6 * * *',
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
  }
];

// Mock Execution History
const mockExecutionHistory = [
  {
    id: 'exec_001',
    taskId: 'task_001',
    startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 60 * 60 * 1000 + 5200).toISOString(),
    duration: 5.2,
    status: 'success',
    output: 'Tweet published successfully: https://twitter.com/elonmusk/status/123456789',
    exitCode: 0
  },
  {
    id: 'exec_002',
    taskId: 'task_001',
    startTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 25 * 60 * 60 * 1000 + 4800).toISOString(),
    duration: 4.8,
    status: 'success',
    output: 'Tweet published successfully: https://twitter.com/elonmusk/status/123456788',
    exitCode: 0
  },
  {
    id: 'exec_003',
    taskId: 'task_001',
    startTime: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 49 * 60 * 60 * 1000 + 15000).toISOString(),
    duration: 15.0,
    status: 'failure',
    output: 'Error: Twitter API rate limit exceeded',
    exitCode: 1
  }
];

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
