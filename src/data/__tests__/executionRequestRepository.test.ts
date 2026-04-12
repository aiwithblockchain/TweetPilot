import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createExecutionRequest,
	type ExecutionRequest,
} from "../../domain/executionRequest";
import { InMemoryExecutionRequestRepository } from "../executionRequestRepository";

function buildRequest(
	overrides: Partial<ExecutionRequest> & {
		accountId?: string;
		taskId?: string;
		channelId?: string;
	},
): ExecutionRequest {
	const request = createExecutionRequest({
		taskId: overrides.taskId ?? "task-001",
		channelId: overrides.channelId ?? "channel-001",
		channelType: "local-bridge",
		actionType: "reply",
		payload: {
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			targetTweetId: "tweet-001",
			replyContent: "Hello",
			accountId: overrides.accountId ?? "acc-001",
			workspaceId: "ws-001",
		},
	});

	return {
		...request,
		...overrides,
		payload: {
			...request.payload,
			accountId: overrides.accountId ?? request.payload.accountId,
		},
	};
}

describe("InMemoryExecutionRequestRepository", () => {
	let repository: InMemoryExecutionRequestRepository;

	beforeEach(() => {
		repository = new InMemoryExecutionRequestRepository();
	});

	it("saves and retrieves a request by id", async () => {
		const request = buildRequest({});

		await repository.save(request);

		expect(await repository.findById(request.id)).toEqual(request);
	});

	it("returns requests for a task", async () => {
		const request1 = buildRequest({ taskId: "task-001" });
		const request2 = buildRequest({ taskId: "task-001", channelId: "channel-002" });
		const request3 = buildRequest({ taskId: "task-002", channelId: "channel-003" });

		await repository.save(request1);
		await repository.save(request2);
		await repository.save(request3);

		expect(await repository.findByTaskId("task-001")).toHaveLength(2);
		expect(await repository.findByTaskId("task-002")).toHaveLength(1);
	});

	it("returns requests for an account sorted by newest first and limited", async () => {
		const oldest = buildRequest({
			accountId: "acc-001",
			taskId: "task-001",
			createdAt: new Date("2026-04-10T10:00:00.000Z"),
			updatedAt: new Date("2026-04-10T10:00:00.000Z"),
		});
		const newest = buildRequest({
			accountId: "acc-001",
			taskId: "task-002",
			channelId: "channel-002",
			createdAt: new Date("2026-04-10T12:00:00.000Z"),
			updatedAt: new Date("2026-04-10T12:00:00.000Z"),
		});
		const otherAccount = buildRequest({
			accountId: "acc-002",
			taskId: "task-003",
			channelId: "channel-003",
			createdAt: new Date("2026-04-10T11:00:00.000Z"),
			updatedAt: new Date("2026-04-10T11:00:00.000Z"),
		});

		await repository.save(oldest);
		await repository.save(newest);
		await repository.save(otherAccount);

		const requests = await repository.findByAccountId("acc-001", 1);

		expect(requests).toHaveLength(1);
		expect(requests[0].id).toBe(newest.id);
	});

	it("returns recent requests by account and channel within a time window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-10T12:00:30.000Z"));

		const recentByAccount = buildRequest({
			accountId: "acc-001",
			taskId: "task-001",
			channelId: "channel-001",
			createdAt: new Date("2026-04-10T12:00:20.000Z"),
			updatedAt: new Date("2026-04-10T12:00:20.000Z"),
		});
		const oldByAccount = buildRequest({
			accountId: "acc-001",
			taskId: "task-002",
			channelId: "channel-002",
			createdAt: new Date("2026-04-10T11:59:00.000Z"),
			updatedAt: new Date("2026-04-10T11:59:00.000Z"),
		});
		const recentByChannel = buildRequest({
			accountId: "acc-002",
			taskId: "task-003",
			channelId: "channel-003",
			createdAt: new Date("2026-04-10T12:00:25.000Z"),
			updatedAt: new Date("2026-04-10T12:00:25.000Z"),
		});

		await repository.save(recentByAccount);
		await repository.save(oldByAccount);
		await repository.save(recentByChannel);

		const accountRequests = await repository.findRecentByAccountId("acc-001", 15000);
		const channelRequests = await repository.findRecentByChannelId("channel-003", 15000);

		expect(accountRequests).toHaveLength(1);
		expect(accountRequests[0].id).toBe(recentByAccount.id);
		expect(channelRequests).toHaveLength(1);
		expect(channelRequests[0].id).toBe(recentByChannel.id);

		vi.useRealTimers();
	});

	it("updates an existing request", async () => {
		const request = buildRequest({});
		await repository.save(request);

		const updated = {
			...request,
			status: "completed" as const,
			updatedAt: new Date("2026-04-10T13:00:00.000Z"),
			result: {
				success: true,
				tweetId: "tweet-999",
				executedAt: new Date("2026-04-10T13:00:00.000Z"),
			},
		};

		await repository.update(updated);

		const stored = await repository.findById(request.id);
		expect(stored?.status).toBe("completed");
		expect(stored?.result?.tweetId).toBe("tweet-999");
	});

	it("throws when updating a missing request", async () => {
		await expect(repository.update(buildRequest({}))).rejects.toThrow(
			/ExecutionRequest .* not found/,
		);
	});
});
