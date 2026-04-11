import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createReplyTask } from "../../src/domain/replyTask";
import ReviewQueueErrorState from "../../src/features/review-queue/ReviewQueueErrorState";
import ReviewQueueSkeleton from "../../src/features/review-queue/ReviewQueueSkeleton";
import ReviewTaskDetail from "../../src/features/review-queue/ReviewTaskDetail";

describe("review queue components", () => {
	it("should render skeleton and error states", () => {
		const retry = vi.fn();
		render(
			<div>
				<ReviewQueueSkeleton />
				<ReviewQueueErrorState message="load failed" onRetry={retry} />
			</div>,
		);

		expect(screen.getByTestId("review-queue-skeleton")).toBeInTheDocument();
		expect(screen.getByRole("alert")).toHaveTextContent("load failed");
	});

	it("should render task detail metadata and timeline", () => {
		const task = {
			...createReplyTask({
				workspaceId: "ws-001",
				accountId: "acc-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "high",
				createdBy: "user-001",
				assigneeId: "owner-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		};

		render(
			<ReviewTaskDetail
				detail={{
					task,
					candidateReply: {
						id: "candidate-001",
						commentInputId: "comment-001",
						accountId: "acc-001",
						workspaceId: "ws-001",
						content: "Candidate body",
						riskLevel: "high",
						confidence: 0.7,
						modelSource: "claude",
						knowledgeHits: 1,
						generatedAt: new Date(),
					},
					commentInput: {
						id: "comment-001",
						workspaceId: "ws-001",
						accountId: "acc-001",
						content: "Comment body",
						createdAt: new Date(),
					},
					events: task.events,
				}}
				governance={{
					actorId: "admin-001",
					actorRole: "admin",
					assigneeId: "owner-001",
					note: "",
					isSubmitting: false,
					error: null,
					setActorId: vi.fn(),
					setActorRole: vi.fn(),
					setAssigneeId: vi.fn(),
					setNote: vi.fn(),
					approve: vi.fn(),
					reject: vi.fn(),
					returnToQueue: vi.fn(),
					assign: vi.fn(),
					takeOver: vi.fn(),
					completeTakeover: vi.fn(),
				} as never}
			/>,
		);

		expect(screen.getByText("Task Metadata")).toBeInTheDocument();
		expect(screen.getByText("Comment body")).toBeInTheDocument();
		expect(screen.getByText("Candidate body")).toBeInTheDocument();
		expect(screen.getByText("Event Timeline")).toBeInTheDocument();
		expect(screen.getByText("task_created")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
	});
});
