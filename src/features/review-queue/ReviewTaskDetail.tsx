import type { ReviewTaskDetailModel } from "./useReviewQueue";
import TaskGovernanceActions from "./TaskGovernanceActions";
import TaskMetadata from "./TaskMetadata";
import TaskTimeline from "./TaskTimeline";
import type { useTaskGovernance } from "./useTaskGovernance";

type ReviewTaskDetailProps = {
	detail: ReviewTaskDetailModel | null;
	governance: ReturnType<typeof useTaskGovernance>;
};

export default function ReviewTaskDetail({
	detail,
	governance,
}: ReviewTaskDetailProps) {
	if (!detail) {
		return (
			<section className="panel review-detail-panel">
				<p className="panel-title">Task Detail</p>
				<p className="muted">
					Select a task from the queue to inspect context and governance history.
				</p>
			</section>
		);
	}

	return (
		<section className="review-detail-panel">
			<div className="review-detail-header panel">
				<p className="panel-title">Task Detail</p>
				<div className="candidate-reply-header">
					<strong>{detail.task.id}</strong>
					<span className={`risk-badge risk-${detail.task.riskLevel}`}>
						{detail.task.riskLevel}
					</span>
				</div>
				<p className="muted">
					Workspace: {detail.task.workspaceId}
					{" · "}
					Account: {detail.task.accountId}
				</p>
			</div>
			<TaskMetadata detail={detail} />
			<TaskGovernanceActions task={detail.task} governance={governance} />
			<TaskTimeline events={detail.events} />
		</section>
	);
}
