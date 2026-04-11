import ReviewQueueErrorState from "./ReviewQueueErrorState";
import ReviewQueueList from "./ReviewQueueList";
import ReviewQueueSkeleton from "./ReviewQueueSkeleton";
import ReviewTaskDetail from "./ReviewTaskDetail";
import { useReviewQueue, type ReviewQueueDependencies } from "./useReviewQueue";
import { useTaskGovernance, type TaskGovernanceDependencies } from "./useTaskGovernance";

type ReviewQueueViewProps = ReviewQueueDependencies & TaskGovernanceDependencies;

export default function ReviewQueueView(props: ReviewQueueViewProps) {
	const reviewQueue = useReviewQueue(props);
	const governance = useTaskGovernance({
		...props,
		selectedTask: reviewQueue.selectedTask?.task ?? null,
		onRefresh: reviewQueue.refresh,
	});
	const currentPage = Math.floor((reviewQueue.query.offset ?? 0) / (reviewQueue.query.limit ?? 5));

	return (
		<div className="review-queue-layout">
			<section className="panel review-workspace-bar">
				<label className="field field-inline">
					<span>Workspace</span>
					<select
						value={reviewQueue.workspaceId}
						onChange={(event) => reviewQueue.setWorkspaceId(event.target.value)}
					>
						{reviewQueue.workspaces.map((workspace) => (
							<option key={workspace.id} value={workspace.id}>
								{workspace.name}
							</option>
						))}
					</select>
				</label>
			</section>

			{reviewQueue.isLoading ? <ReviewQueueSkeleton /> : null}
			{!reviewQueue.isLoading && reviewQueue.error ? (
				<ReviewQueueErrorState
					message={reviewQueue.error}
					onRetry={() => void reviewQueue.refresh()}
				/>
			) : null}
			{!reviewQueue.isLoading && !reviewQueue.error ? (
				<div className="review-queue-grid">
					<ReviewQueueList
						items={reviewQueue.items}
						selectedTaskId={reviewQueue.selectedTaskId}
						total={reviewQueue.total}
						page={currentPage}
						pageSize={reviewQueue.query.limit ?? 5}
						riskLevel={reviewQueue.query.riskLevel}
						onSelectTask={reviewQueue.selectTask}
						onChangePage={reviewQueue.setPage}
						onChangeRiskLevel={reviewQueue.setRiskLevel}
					/>
					<ReviewTaskDetail
						detail={reviewQueue.selectedTask}
						governance={governance}
					/>
				</div>
			) : null}
		</div>
	);
}
