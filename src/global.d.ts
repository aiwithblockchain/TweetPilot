import type { TweetOpsAPI } from '../electron/preload';

declare global {
  interface Window {
    tweetOps: TweetOpsAPI;
  }
}

export {};
