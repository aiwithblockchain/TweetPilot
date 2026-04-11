import type { ReviewTaskDetailModel } from "./useReviewQueue";

type TaskMetadataProps = {
	detail: ReviewTaskDetailModel;
};

export default function TaskMetadata({ detail }: TaskMetadataProps) {
	return (
		<section className="panel compact">
			<p className="panel-title">Task Metadata</p>
			<div className="metadata-grid">
				<div className="metadata-item">
					<span>Status</span>
					<strong>{detail.task.status}</strong>
				</div>
				<div className="metadata-item">
					<span>Risk</span>
					<strong>{detail.task.riskLevel}</strong>
				</div>
				<div className="metadata-item">
					<span>Assignee</span>
					<strong>{detail.task.assigneeId ?? "Unassigned"}</strong>
				</div>
				<div className="metadata-item">
					<span>Taken Over By</span>
					<strong>{detail.task.takenOverBy ?? "Not in takeover"}</strong>
				</div>
				<div className="metadata-item metadata-item-wide">
					<span>Comment Input</span>
					<strong>{detail.commentInput?.content ?? "Context missing"}</strong>
				</div>
				<div className="metadata-item metadata-item-wide">
					<span>Candidate Reply</span>
					<strong>
						{detail.candidateReply?.content ?? "Candidate reply missing"}
					</strong>
				</div>
			</div>
		</section>
	);
}
