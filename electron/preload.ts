import { contextBridge, ipcRenderer } from 'electron';

// Structured IPC response types
interface IPCError {
  success: false;
  error: string;
  stack?: string;
}

interface IPCSuccess<T> {
  success: true;
  data: T;
}

type IPCResult<T> = IPCSuccess<T> | IPCError;

// Helper to unwrap IPC results
function unwrapIPCResult<T>(result: IPCResult<T>): T {
  if (result.success) {
    return result.data;
  }
  const error = new Error(result.error);
  if (result.stack) {
    error.stack = result.stack;
  }
  throw error;
}

export interface TweetOpsAPI {
  appName: string;
  runtime: {
    platform: NodeJS.Platform;
  };
  localBridge: {
    getInstances: () => Promise<any>;
    getTabStatus: (instanceId?: string) => Promise<any>;
    getTweet: (tweetId: string, tabId?: number) => Promise<any>;
    getTweetReplies: (tweetId: string, cursor?: string, tabId?: number) => Promise<any>;
  };
}

const api: TweetOpsAPI = {
  appName: 'TweetPilot',
  runtime: {
    platform: process.platform,
  },
  localBridge: {
    getInstances: async () => {
      const result = await ipcRenderer.invoke('localBridge:getInstances');
      return unwrapIPCResult(result);
    },
    getTabStatus: async (instanceId?: string) => {
      const result = await ipcRenderer.invoke('localBridge:getTabStatus', instanceId);
      return unwrapIPCResult(result);
    },
    getTweet: async (tweetId: string, tabId?: number) => {
      const result = await ipcRenderer.invoke('localBridge:getTweet', tweetId, tabId);
      return unwrapIPCResult(result);
    },
    getTweetReplies: async (tweetId: string, cursor?: string, tabId?: number) => {
      const options = cursor || tabId ? { cursor, tabId } : undefined;
      const result = await ipcRenderer.invoke('localBridge:getTweetReplies', tweetId, options);
      return unwrapIPCResult(result);
    },
  },
};

contextBridge.exposeInMainWorld('tweetOps', api);
