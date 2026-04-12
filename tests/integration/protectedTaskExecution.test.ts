import { describe, expect, it, vi } from "vitest";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryExecutionRequestRepository } from "../../src/data/executionRequestRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";
import type { ITwitterReplyExecutor } from "../../src/domain/twitterReplyExecutor";
import { ExecutionCooldownChecker } from "../../src/domain/executionCooldown";
import { DuplicateExecutionProtector } from "../../src/domain/executionProtection";
import { ExecutionEligibilityService } from "../../src/services/executionEligibilityService";
import { ExecutionFailureHandler } from "../../src/services/executionFailureHandler";
import { ExecutionPreparationService } from "../../src/services/executionPreparationService";
import { ExecutionProtectionService } from "../../src/services/executionProtectionService";
import { ExecutionRequestBuilder } from "../../src/services/executionRequestBuilder";
import { ExecutionService } from "../../src/services/executionService";
import { ProtectedTaskExecutionOrchestrator } from "../../src/services/protectedTaskExecutionOrchestrator";
import { TaskExecutionOrchestrator } from "../../src/services/taskExecutionOrchestrator";
import { TaskExecutionResultWriter } from "../../src/services/taskExecutionResultWriter";

async function seedReadyTask(
	commentInputRepository: InMemoryCommentInputRepository,
	candidateReplyRepository: InMemoryCandidateReplyRepository,
	taskRepository: InMemoryReplyTaskRepository,
) {
	const commentInput = createCommentInput({
		workspaceId: "ws-001",
		accountId: "acc-001",
		content: "Question",
		targetTweetId: "tweet-123",
	});
	await commentInputRepository.save(commentInput);

	const candidateReply = createCandidateReply({
		commentInputId: commentInput.id,
		accountId: "acc-001",
		workspaceId: "ws-001",
		content: "Answer",
		riskLevel: "low",
		confidence: 0.88,
		modelSource: "claude",
		knowledgeHits: 0,
	});
	await candidateReplyRepository.save(candidateReply);

	const task = createReplyTask({
		workspaceId: "ws-001",
		accountId: "acc-001",
		commentInputId: commentInput.id,
		candidateReplyId: candidateReply.id,
		riskLevel: "low",
		createdBy: "user-001",
		status: "ready_for_execution",
		route: "ready_for_execution",
	});
	await taskRepository.save(task);

	return { task };
}

function buildProtectedOrchestrator(
	executor: ITwitterReplyExecutor,
	options?: { cooldownMs?: number },
) {
	const commentInputRepository = new InMemoryCommentInputRepository();
	const candidateReplyRepository = new InMemoryCandidateReplyRepository();
	const taskRepository = new InMemoryReplyTaskRepository();
	const requestRepository = new InMemoryExecutionRequestRepository();
	const channel: ExecutionChannel = {
		id: "ch-001",
		name: "Local Bridge",
		type: "local-bridge",
		accountId: "acc-001",
		status: "available",
		capabilities: ["reply"],
	};

	const builder = new ExecutionRequestBuilder(commentInputRepository);
	const preparationService = new ExecutionPreparationService(
		candidateReplyRepository,
		new ExecutionEligibilityService(),
		builder,
	);
	const baseOrchestrator = new TaskExecutionOrchestrator(
		taskRepository,
		requestRepository,
		preparationService,
		new ExecutionService(requestRepository, executor),
		new TaskExecutionResultWriter(taskRepository, requestRepository),
		{
			getChannels: (accountId?: string) =>
				accountId === "acc-001" ? [channel] : [],
			getChannel: (channelId: string) => (channelId === channel.id ? channel : null),
		},
	);

	return {
		commentInputRepository,
		candidateReplyRepository,
		taskRepository,
		requestRepository,
		channel,
		orchestrator: new ProtectedTaskExecutionOrchestrator(
			taskRepository,
			requestRepository,
			{
				getChannels: (accountId?: string) =>
					accountId === "acc-001" ? [channel] : [],
				getChannel: (channelId: string) => (channelId === channel.id ? channel : null),
			},
			new ExecutionEligibilityService(),
			baseOrchestrator,
			new ExecutionProtectionService(
				requestRepository,
				new DuplicateExecutionProtector(),
				new ExecutionCooldownChecker({
					minIntervalMs: options?.cooldownMs ?? 5000,
				}),
			),
			new ExecutionFailureHandler(taskRepository),
		),
	};
}

describe("protectedTaskExecution integration", () => {
	it("executes successfully when protection checks pass", async () => {
		const env = buildProtectedOrchestrator({
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: true,
				replyTweetId: "tweet-999",
				rawResponse: { ok: true },
			}),
		});
		const { task } = await seedReadyTask(
			env.commentInputRepository,
			env.candidateReplyRepository,
			env.taskRepository,
		);

		const result = await env.orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
			actorRoles: ["executor"],
		});

		const storedTask = await env.taskRepository.findById(task.id);
		expect(result.success).toBe(true);
		expect(storedTask?.events.at(-1)?.type).toBe("task_completed");
	});

	it("rejects execution when protection check fails", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-12T01:00:05.000Z"));

		const env = buildProtectedOrchestrator(
			{
				type: "localbridge",
				isAvailable: async () => true,
				postReply: async () => ({
					success: true,
					replyTweetId: "tweet-999",
				}),
			},
			{ cooldownMs: 5000 },
		);
		const { task } = await seedReadyTask(
			env.commentInputRepository,
			env.candidateReplyRepository,
			env.taskRepository,
		);
		await env.requestRepository.save({
			id: "req-existing",
			taskId: "task-other",
			channelId: env.channel.id,
			channelType: env.channel.type,
			actionType: "reply",
			status: "failed",
			payload: {
				commentInputId: "ci-old",
				candidateReplyId: "cr-old",
				targetTweetId: "tweet-old",
				replyContent: "old",
				accountId: "acc-001",
				workspaceId: "ws-001",
			},
			createdAt: new Date("2026-04-12T01:00:03.000Z"),
			updatedAt: new Date("2026-04-12T01:00:03.000Z"),
		});

		const result = await env.orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
			actorRoles: ["executor"],
		});

		expect(result).toMatchObject({
			success: false,
			error: {
				code: "PROTECTION_VIOLATION",
			},
		});
		vi.useRealTimers();
	});

	it("handles failed execution by moving task into takeover", async () => {
		const env = buildProtectedOrchestrator({
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: false,
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			}),
		});
		const { task } = await seedReadyTask(
			env.commentInputRepository,
			env.candidateReplyRepository,
			env.taskRepository,
		);

		const result = await env.orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
			actorRoles: ["executor"],
		});

		const storedTask = await env.taskRepository.findById(task.id);
		expect(result.success).toBe(false);
		expect(storedTask?.status).toBe("in_takeover");
		expect(
			storedTask?.events.filter((event) => event.type === "task_failed"),
		).toHaveLength(1);
	});

	it("allows retry after a retryable failure and then succeeds", async () => {
		let attempt = 0;
		const env = buildProtectedOrchestrator(
			{
				type: "localbridge",
				isAvailable: async () => true,
				postReply: async () => {
					attempt += 1;
					if (attempt === 1) {
						return {
							success: false,
							code: "NETWORK_ERROR",
							message: "temporary issue",
							retryable: true,
						};
					}

					return {
						success: true,
						replyTweetId: "tweet-1000",
					};
				},
			},
			{ cooldownMs: 0 },
		);
		const { task } = await seedReadyTask(
			env.commentInputRepository,
			env.candidateReplyRepository,
			env.taskRepository,
		);

		const first = await env.orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
			actorRoles: ["executor"],
		});
		const second = await env.orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
			actorRoles: ["executor"],
		});

		const requests = await env.requestRepository.findByTaskId(task.id);
		expect(first.success).toBe(false);
		expect(second.success).toBe(true);
		expect(requests).toHaveLength(2);
	});
});
