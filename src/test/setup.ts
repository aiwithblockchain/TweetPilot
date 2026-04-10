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
		},
		writable: true,
	});
});
