import type { ReviewQueueItem } from "../../domain/reviewQueue";

type ReviewQueueListProps = {
	items: ReviewQueueItem[];
	selectedTaskId: string | null;
	total: number;
	page: number;
	pageSize: number;
	riskLevel?: "medium" | "high";
	onSelectTask: (taskId: string) => void;
	onChangePage: (page: number) => void;
	onChangeRiskLevel: (riskLevel?: "medium" | "high") => void;
};

export default function ReviewQueueList({
	items,
	selectedTaskId,
	total,
	page,
	pageSize,
	riskLevel,
	onSelectTask,
	onChangePage,
	onChangeRiskLevel,
}: ReviewQueueListProps) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	return (
		<section className="panel review-list-panel">
			<div className="review-list-header">
				<div>
					<p className="panel-title">Pending Review Queue</p>
					<p className="muted">Total tasks: {total}</p>
				</div>
				<label className="field field-inline">
					<span>Risk Level</span>
					<select
						value={riskLevel ?? "all"}
						onChange={(event) =>
							onChangeRiskLevel(
								event.target.value === "all"
									? undefined
									: (event.target.value as "medium" | "high"),
							)
						}
					>
						<option value="all">All</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
					</select>
				</label>
			</div>

			{items.length === 0 ? (
				<p className="muted">
					No tasks currently require manual review in this workspace.
				</p>
			) : (
				<div className="review-list-items">
					{items.map((item) => (
						<button
							key={item.taskId}
							type="button"
							className={`review-list-item ${selectedTaskId === item.taskId ? "is-selected" : ""}`}
							onClick={() => onSelectTask(item.taskId)}
						>
							<div className="candidate-reply-header">
								<strong>{item.commentInput.content}</strong>
								<span className={`risk-badge risk-${item.riskLevel}`}>
									{item.riskLevel}
								</span>
							</div>
							<p className="muted">
								{item.candidateReply.content}
							</p>
							<p className="muted">
								Assignee: {item.assigneeId ?? "Unassigned"}
							</p>
						</button>
					))}
				</div>
			)}

			<div className="review-pagination">
				<span className="muted">
					Page {Math.min(page + 1, pageCount)} / {pageCount}
				</span>
				<div className="action-row">
					<button
						type="button"
						className="secondary-button"
						onClick={() => onChangePage(page - 1)}
						disabled={page === 0}
					>
						Previous
					</button>
					<button
						type="button"
						className="secondary-button"
						onClick={() => onChangePage(page + 1)}
						disabled={page + 1 >= pageCount}
					>
						Next
					</button>
				</div>
			</div>
		</section>
	);
}
