import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createExecutionRequest,
	generateExecutionRequestId,
} from "../executionRequest";

describe("executionRequest", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("generates ids with the expected prefix", () => {
		vi.spyOn(Date, "now").mockReturnValue(1712345678901);
		vi.spyOn(Math, "random").mockReturnValue(0.123456789);

		expect(generateExecutionRequestId()).toMatch(/^exec-req-1712345678901-/);
	});

	it("creates a pending execution request with timestamps", () => {
		const request = createExecutionRequest({
			taskId: "task-001",
			channelId: "channel-001",
			channelType: "local-bridge",
			actionType: "reply",
			payload: {
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				targetTweetId: "tweet-001",
				replyContent: "Hello",
				accountId: "acc-001",
				workspaceId: "ws-001",
				roleId: "role-001",
			},
		});

		expect(request.id).toMatch(/^exec-req-/);
		expect(request.status).toBe("pending");
		expect(request.result).toBeUndefined();
		expect(request.error).toBeUndefined();
		expect(request.createdAt).toBeInstanceOf(Date);
		expect(request.updatedAt).toBeInstanceOf(Date);
		expect(request.createdAt.getTime()).toBe(request.updatedAt.getTime());
		expect(request.payload.targetTweetId).toBe("tweet-001");
	});
});
