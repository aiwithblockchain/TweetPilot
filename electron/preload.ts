import { contextBridge } from 'electron';

const api = {
  appName: 'TweetPilot',
  runtime: {
    platform: process.platform,
  },
};

contextBridge.exposeInMainWorld('tweetOps', api);
