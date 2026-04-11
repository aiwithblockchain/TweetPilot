import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import { createReplyTask } from "../../src/domain/replyTask";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createReplyTaskCreationService } from "../../src/services/replyTaskCreationService";
import { createReviewQueueService } from "../../src/services/reviewQueueService";
import {
	TaskOwnershipErrorCode,
	createTaskOwnershipService,
} from "../../src/services/taskOwnershipService";
import { createTaskRoutingService } from "../../src/services/taskRoutingService";

describe("taskOwnershipService integration", () => {
	it("should assign pending review tasks and expose assignee in review queue", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const commentInputRepository = new InMemoryCommentInputRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const reviewQueueService = createReviewQueueService({
			candidateReplyRepository,
			commentInputRepository,
			replyTaskRepository,
		});
		const taskOwnershipService = createTaskOwnershipService({
			replyTaskRepository,
		});
		const commentInput = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need ownership assignment",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High risk response",
			riskLevel: "high",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});

		await commentInputRepository.save(commentInput);
		await candidateReplyRepository.save(candidateReply);

		const created = await taskCreationService.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "router-001",
		});

		if (created.status !== "created") {
			throw new Error("Expected created task");
		}

		await taskOwnershipService.assignTask(
			created.task.id,
			"owner-001",
			"owner-001",
		);

		const queue = await reviewQueueService.listPending("workspace-001");

		expect(queue.items[0]?.assigneeId).toBe("owner-001");
	});

	it("should write takeover events and keep state consistent after review plus takeover", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const commentInputRepository = new InMemoryCommentInputRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const reviewQueueService = createReviewQueueService({
			candidateReplyRepository,
			commentInputRepository,
			replyTaskRepository,
		});
		const taskOwnershipService = createTaskOwnershipService({
			replyTaskRepository,
		});
		const commentInput = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need manual completion",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Medium risk response",
			riskLevel: "medium",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});

		await commentInputRepository.save(commentInput);
		await candidateReplyRepository.save(candidateReply);

		const created = await taskCreationService.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "router-001",
		});

		if (created.status !== "created") {
			throw new Error("Expected created task");
		}

		const reviewed = await reviewQueueService.decide({
			taskId: created.task.id,
			action: "approve",
			actorId: "reviewer-001",
			actorRoles: ["reviewer"],
		});
		const assigned = await taskOwnershipService.assignTask(
			reviewed.id,
			"owner-001",
			"owner-001",
		);
		const takenOver = await taskOwnershipService.takeOverTask(
			assigned.id,
			"owner-001",
			"Escalated for manual handling",
			{
				expectedVersion: assigned.version,
			},
		);
		const completed = await taskOwnershipService.completeTakeover(
			takenOver.id,
			"owner-001",
			"ready_for_execution",
			"Manual checks passed",
		);
		const events = await replyTaskRepository.findEvents(completed.id);

		expect(completed.status).toBe("ready_for_execution");
		expect(events.map((event) => event.type)).toContain("task_assigned");
		expect(events.filter((event) => event.type === "task_taken_over")).toHaveLength(
			2,
		);
	});

	it("should allow only one takeover request when two actors use the same expectedVersion", async () => {
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskOwnershipService = createTaskOwnershipService({
			replyTaskRepository,
		});
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "high",
				createdBy: "user-001",
				assigneeId: "owner-001",
			}),
			status: "assigned" as const,
			route: "pending_review" as const,
		};
		await replyTaskRepository.save(task);

		const firstTakeover = await taskOwnershipService.takeOverTask(
			task.id,
			"owner-001",
			undefined,
			{
				expectedVersion: task.version,
			},
		);

		expect(firstTakeover.status).toBe("in_takeover");

		await expect(
			taskOwnershipService.takeOverTask(task.id, "admin-001", undefined, {
				expectedVersion: task.version,
				actorRoles: ["admin"],
			}),
		).rejects.toMatchObject({
			code: TaskOwnershipErrorCode.TASK_TAKEOVER_CONFLICT,
		});
	});
});
