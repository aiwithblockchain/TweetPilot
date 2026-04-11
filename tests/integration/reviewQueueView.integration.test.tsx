import { render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import ReviewQueueView from "../../src/features/review-queue/ReviewQueueView";
import { createReplyTaskCreationService } from "../../src/services/replyTaskCreationService";
import { createReviewQueueService } from "../../src/services/reviewQueueService";
import { createTaskOwnershipService } from "../../src/services/taskOwnershipService";
import { createTaskRoutingService } from "../../src/services/taskRoutingService";

async function buildReviewQueueDependencies() {
	const commentInputRepository = new InMemoryCommentInputRepository();
	const candidateReplyRepository = new InMemoryCandidateReplyRepository();
	const replyTaskRepository = new InMemoryReplyTaskRepository();
	const reviewQueueService = createReviewQueueService({
		replyTaskRepository,
		candidateReplyRepository,
		commentInputRepository,
	});
	const taskOwnershipService = createTaskOwnershipService({
		replyTaskRepository,
	});
	const taskCreationService = createReplyTaskCreationService({
		candidateReplyRepository,
		replyTaskRepository,
		taskRoutingService: createTaskRoutingService({
			replyTaskRepository,
		}),
	});

	return {
		commentInputRepository,
		candidateReplyRepository,
		replyTaskRepository,
		reviewQueueService,
		taskOwnershipService,
		taskCreationService,
		platformState: {
			getWorkspaces: () => [
				{
					id: "ws-001",
					name: "Workspace 1",
					description: "test",
				},
			],
		},
	};
}

describe("ReviewQueueView integration", () => {
	it("should render queue detail and remove task after approval", async () => {
		const deps = await buildReviewQueueDependencies();
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "High risk input",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Escalate to team",
			riskLevel: "high",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await deps.commentInputRepository.save(commentInput);
		await deps.candidateReplyRepository.save(candidateReply);
		await deps.taskCreationService.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "router-001",
		});

		render(<ReviewQueueView {...deps} />);

		expect((await screen.findAllByText("High risk input")).length).toBeGreaterThan(
			0,
		);
		expect(
			(await screen.findAllByText("Escalate to team")).length,
		).toBeGreaterThan(0);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Approve" }));

		await waitFor(() => {
			expect(
				screen.getByText(/No tasks currently require manual review/i),
			).toBeInTheDocument();
		});
	});

	it("should update assignee and takeover detail after governance actions", async () => {
		const deps = await buildReviewQueueDependencies();
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Need manual handling",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Manual response draft",
			riskLevel: "high",
			confidence: 0.75,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await deps.commentInputRepository.save(commentInput);
		await deps.candidateReplyRepository.save(candidateReply);
		await deps.taskCreationService.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "router-001",
		});

		render(<ReviewQueueView {...deps} />);

		expect(
			(await screen.findAllByText("Need manual handling")).length,
		).toBeGreaterThan(0);
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "Approve" }));
		await waitFor(() => {
			expect(screen.getByText("ready_for_execution")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText("Assignee ID"));
		await user.type(screen.getByLabelText("Assignee ID"), "owner-777");
		await user.click(screen.getByRole("button", { name: "Assign" }));

		await waitFor(() => {
			expect(screen.getByText("owner-777")).toBeInTheDocument();
			expect(screen.getByText("assigned")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Take Over" }));

		await waitFor(() => {
			expect(screen.getByText("in_takeover")).toBeInTheDocument();
			expect(screen.getByText("admin-001")).toBeInTheDocument();
		});
	});

	it("should refresh list and total when pagination changes", async () => {
		const deps = await buildReviewQueueDependencies();

		for (const content of ["Queue item one", "Queue item two"]) {
			const commentInput = createCommentInput({
				workspaceId: "ws-001",
				accountId: "acc-001",
				content,
			});
			const candidateReply = createCandidateReply({
				commentInputId: commentInput.id,
				accountId: "acc-001",
				workspaceId: "ws-001",
				content: `Reply for ${content}`,
				riskLevel: "high",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 1,
			});
			await deps.commentInputRepository.save(commentInput);
			await deps.candidateReplyRepository.save(candidateReply);
			await deps.taskCreationService.createFromCandidateReply({
				candidateReplyId: candidateReply.id,
				triggeredBy: "router-001",
			});
		}

		render(<ReviewQueueView {...deps} pageSize={1} />);

		expect(await screen.findByText("Total tasks: 2")).toBeInTheDocument();
		const listPanel = screen.getByText("Pending Review Queue").closest("section");

		if (!listPanel) {
			throw new Error("Expected review list panel");
		}

		const firstPageTaskTitle = within(listPanel).getAllByRole("button")[0];
		const firstPageText = firstPageTaskTitle.textContent ?? "";
		expect(firstPageText).toMatch(/Queue item (one|two)/);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Next" }));

		await waitFor(() => {
			const nextListPanel = screen
				.getByText("Pending Review Queue")
				.closest("section");

			if (!nextListPanel) {
				throw new Error("Expected updated review list panel");
			}

			expect(within(nextListPanel).getAllByRole("button")[0].textContent).not.toBe(
				firstPageText,
			);
		});
	});
});
