import { beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";

beforeAll(() => {
	// Mock window.tweetOps for tests
	Object.defineProperty(window, "tweetOps", {
		value: {
			appName: "TweetPilot",
			runtime: {
				platform: "darwin",
			},
			localBridge: {
				getInstances: async () => [],
				getTabStatus: async () => ({
					tabs: [],
					hasXTabs: false,
					isLoggedIn: false,
				}),
				getTweet: async () => ({}),
				getTweetReplies: async () => ({}),
			},
		},
		writable: true,
	});
});
