import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReviewQueueList from "../../src/features/review-queue/ReviewQueueList";

describe("ReviewQueueList", () => {
	it("should render queue rows and forward filter and pagination actions", async () => {
		const onSelectTask = vi.fn();
		const onChangePage = vi.fn();
		const onChangeRiskLevel = vi.fn();

		render(
			<ReviewQueueList
				items={[
					{
						taskId: "task-001",
						candidateReplyId: "candidate-001",
						commentInputId: "comment-001",
						accountId: "acc-001",
						workspaceId: "ws-001",
						riskLevel: "high",
						createdAt: new Date("2026-04-11T10:00:00.000Z"),
						candidateReply: {
							id: "candidate-001",
							content: "Escalate this reply",
							confidence: 0.7,
							modelSource: "claude",
							generatedAt: new Date("2026-04-11T10:00:00.000Z"),
						},
						commentInput: {
							id: "comment-001",
							content: "High risk comment",
							targetTweetId: "tweet-001",
							targetTweetUrl: "https://x.com/example/status/1",
							createdAt: new Date("2026-04-11T09:59:00.000Z"),
						},
					},
				]}
				selectedTaskId="task-001"
				total={6}
				page={0}
				pageSize={5}
				riskLevel="high"
				onSelectTask={onSelectTask}
				onChangePage={onChangePage}
				onChangeRiskLevel={onChangeRiskLevel}
			/>,
		);

		expect(screen.getByText("High risk comment")).toBeInTheDocument();
		expect(screen.getByText("Total tasks: 6")).toBeInTheDocument();
		expect(screen.getByText("Page 1 / 2")).toBeInTheDocument();

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /High risk comment/i }));
		await user.selectOptions(screen.getByRole("combobox"), "all");
		await user.click(screen.getByRole("button", { name: "Next" }));

		expect(onSelectTask).toHaveBeenCalledWith("task-001");
		expect(onChangeRiskLevel).toHaveBeenCalledWith(undefined);
		expect(onChangePage).toHaveBeenCalledWith(1);
	});
});
