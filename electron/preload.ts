import { contextBridge, ipcRenderer } from 'electron';

export interface TweetOpsAPI {
  appName: string;
  runtime: {
    platform: NodeJS.Platform;
  };
  localBridge: {
    getInstances: () => Promise<any>;
    getTabStatus: (instanceId?: string) => Promise<any>;
    getTweet: (tweetId: string, tabId?: number) => Promise<any>;
    getTweetReplies: (tweetId: string, options?: { cursor?: string; tabId?: number }) => Promise<any>;
  };
}

const api: TweetOpsAPI = {
  appName: 'TweetPilot',
  runtime: {
    platform: process.platform,
  },
  localBridge: {
    getInstances: () => ipcRenderer.invoke('localBridge:getInstances'),
    getTabStatus: (instanceId?: string) => ipcRenderer.invoke('localBridge:getTabStatus', instanceId),
    getTweet: (tweetId: string, tabId?: number) => ipcRenderer.invoke('localBridge:getTweet', tweetId, tabId),
    getTweetReplies: (tweetId: string, options?: { cursor?: string; tabId?: number }) =>
      ipcRenderer.invoke('localBridge:getTweetReplies', tweetId, options),
  },
};

contextBridge.exposeInMainWorld('tweetOps', api);
