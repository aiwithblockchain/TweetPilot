import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import { createReplyTask } from "../../src/domain/replyTask";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createReviewQueueService } from "../../src/services/reviewQueueService";
import { useReviewQueue } from "../../src/features/review-queue/useReviewQueue";

function ReviewQueueHookHarness(props: Parameters<typeof useReviewQueue>[0]) {
	const vm = useReviewQueue(props);

	return (
		<div>
			<p data-testid="loading">{String(vm.isLoading)}</p>
			<p data-testid="total">{vm.total}</p>
			<p data-testid="selected">{vm.selectedTask?.task.id ?? "none"}</p>
			<p data-testid="error">{vm.error ?? "none"}</p>
			<button type="button" onClick={() => void vm.refresh()}>
				refresh
			</button>
		</div>
	);
}

describe("useReviewQueue", () => {
	it("should load queue items and refresh selected detail", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const queueService = createReviewQueueService({
			replyTaskRepository,
			candidateReplyRepository,
			commentInputRepository,
		});
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Need a review",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "High risk reply",
			riskLevel: "high",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await commentInputRepository.save(commentInput);
		await candidateReplyRepository.save(candidateReply);
		await replyTaskRepository.save({
			...createReplyTask({
				workspaceId: "ws-001",
				accountId: "acc-001",
				commentInputId: commentInput.id,
				candidateReplyId: candidateReply.id,
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_review",
			route: "pending_review",
		});

		render(
			<ReviewQueueHookHarness
				reviewQueueService={queueService}
				replyTaskRepository={replyTaskRepository}
				candidateReplyRepository={candidateReplyRepository}
				commentInputRepository={commentInputRepository}
				platformState={{
					getWorkspaces: () => [
						{
							id: "ws-001",
							name: "Workspace 1",
							description: "test",
						},
					],
				}}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("loading")).toHaveTextContent("false");
			expect(screen.getByTestId("total")).toHaveTextContent("1");
		});
		expect(screen.getByTestId("selected").textContent).not.toBe("none");

		await replyTaskRepository.save({
			...(
				await replyTaskRepository.findByCandidateReplyId(candidateReply.id)
			)!,
			status: "ready_for_execution",
		});
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "refresh" }));

		await waitFor(() => {
			expect(screen.getByTestId("selected")).not.toHaveTextContent("none");
		});
	});

	it("should surface loading errors", async () => {
		render(
			<ReviewQueueHookHarness
				reviewQueueService={{
					listPending: async () => {
						throw new Error("queue down");
					},
				}}
				replyTaskRepository={{
					findById: async () => null,
					findEvents: async () => [],
				}}
				candidateReplyRepository={{
					findById: async () => null,
				}}
				commentInputRepository={{
					findById: async () => null,
				}}
				platformState={{
					getWorkspaces: () => [
						{
							id: "ws-001",
							name: "Workspace 1",
							description: "test",
						},
					],
				}}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByTestId("error")).toHaveTextContent("queue down");
		});
	});
});
