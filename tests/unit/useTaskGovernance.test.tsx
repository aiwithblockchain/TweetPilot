import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createReplyTask } from "../../src/domain/replyTask";
import { useTaskGovernance } from "../../src/features/review-queue/useTaskGovernance";

function TaskGovernanceHookHarness(
	props: Parameters<typeof useTaskGovernance>[0],
) {
	const governance = useTaskGovernance(props);

	return (
		<div>
			<p data-testid="error">{governance.error ?? "none"}</p>
			<button type="button" onClick={() => void governance.approve()}>
				approve
			</button>
		</div>
	);
}

describe("useTaskGovernance", () => {
	it("should refresh after successful governance action", async () => {
		const decide = vi.fn().mockResolvedValue(undefined);
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		const task = {
			...createReplyTask({
				workspaceId: "ws-001",
				accountId: "acc-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		};

		render(
			<TaskGovernanceHookHarness
				selectedTask={task}
				onRefresh={onRefresh}
				reviewQueueService={{ decide }}
				taskOwnershipService={{
					assignTask: vi.fn(),
					takeOverTask: vi.fn(),
					completeTakeover: vi.fn(),
				}}
			/>,
		);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "approve" }));

		await waitFor(() => {
			expect(decide).toHaveBeenCalledTimes(1);
			expect(onRefresh).toHaveBeenCalledTimes(1);
		});
	});

	it("should expose action errors", async () => {
		render(
			<TaskGovernanceHookHarness
				selectedTask={{
					...createReplyTask({
						workspaceId: "ws-001",
						accountId: "acc-001",
						commentInputId: "comment-001",
						candidateReplyId: "candidate-001",
						riskLevel: "high",
						createdBy: "user-001",
					}),
					status: "pending_review",
					route: "pending_review",
				}}
				onRefresh={vi.fn().mockResolvedValue(undefined)}
				reviewQueueService={{
					decide: vi.fn().mockRejectedValue(new Error("denied")),
				}}
				taskOwnershipService={{
					assignTask: vi.fn(),
					takeOverTask: vi.fn(),
					completeTakeover: vi.fn(),
				}}
			/>,
		);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "approve" }));

		await waitFor(() => {
			expect(screen.getByTestId("error")).toHaveTextContent("denied");
		});
	});
});
