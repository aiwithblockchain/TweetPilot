import { contextBridge } from 'electron';

export interface TweetOpsAPI {
  appName: string;
  runtime: {
    platform: NodeJS.Platform;
  };
}

const api: TweetOpsAPI = {
  appName: 'TweetPilot',
  runtime: {
    platform: process.platform,
  },
};

contextBridge.exposeInMainWorld('tweetOps', api);
