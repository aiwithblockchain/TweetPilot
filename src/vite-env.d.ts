/// <reference types="vite/client" />

declare global {
	interface Window {
		tweetOps: {
			appName: string;
			runtime: {
				platform: string;
			};
		};
	}
}

export {};
