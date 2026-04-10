// Global repository instance for comment inputs
// This provides a singleton instance that can be used across the application

import { createCommentInput } from "../domain/commentInput";
import { InMemoryCommentInputRepository } from "./commentInputRepository";

// Create a singleton instance
export const commentInputRepository = new InMemoryCommentInputRepository();

const seededCommentInputs = [
	createCommentInput({
		workspaceId: "ws-001",
		accountId: "acc-001",
		content: "Great post! Thanks for sharing this insight.",
		targetTweetId: "tweet-demo-001",
		targetTweetUrl: "https://x.com/tweetpilot/status/1001",
		metadata: {
			source: "seed",
			authorUsername: "customer_alpha",
		},
	}),
	createCommentInput({
		workspaceId: "ws-001",
		accountId: "acc-001",
		content: "Could you explain how to enable this feature?",
		targetTweetId: "tweet-demo-002",
		targetTweetUrl: "https://x.com/tweetpilot/status/1002",
		metadata: {
			source: "seed",
			authorUsername: "customer_beta",
		},
	}),
	createCommentInput({
		workspaceId: "ws-002",
		accountId: "acc-002",
		content: "Interesting campaign. Is there a sign-up link?",
		targetTweetId: "tweet-demo-003",
		targetTweetUrl: "https://x.com/tweetpilot/status/2001",
		metadata: {
			source: "seed",
			authorUsername: "growth_viewer",
		},
	}),
];

seededCommentInputs.forEach((commentInput) => {
	void commentInputRepository.save(commentInput);
});
