import { describe, it, expect } from 'vitest';

describe('Preload API', () => {
  it('should expose tweetOps API on window', () => {
    expect(window.tweetOps).toBeDefined();
  });

  it('should have appName property', () => {
    expect(window.tweetOps.appName).toBe('TweetPilot');
  });

  it('should have runtime.platform property', () => {
    expect(window.tweetOps.runtime).toBeDefined();
    expect(window.tweetOps.runtime.platform).toBeDefined();
    expect(typeof window.tweetOps.runtime.platform).toBe('string');
  });

  it('should have correct API structure', () => {
    const api = window.tweetOps;
    expect(api).toHaveProperty('appName');
    expect(api).toHaveProperty('runtime');
    expect(api.runtime).toHaveProperty('platform');
  });
});
