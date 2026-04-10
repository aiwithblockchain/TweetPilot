import type { CandidateReply } from "../../domain/candidateReply";

type CandidateReplyListProps = {
	replies: CandidateReply[];
	selectedReplyId?: string | null;
	isGenerating?: boolean;
	onSelectReply?: (reply: CandidateReply) => void;
};

function getRiskBadgeClass(riskLevel: CandidateReply["riskLevel"]): string {
	switch (riskLevel) {
		case "high":
			return "risk-badge risk-high";
		case "medium":
			return "risk-badge risk-medium";
		default:
			return "risk-badge risk-low";
	}
}

export default function CandidateReplyList({
	replies,
	selectedReplyId,
	isGenerating = false,
	onSelectReply,
}: CandidateReplyListProps) {
	return (
		<section className="panel reply-panel">
			<p className="panel-title">Candidate Replies</p>
			{isGenerating && replies.length === 0 ? (
				<p className="muted">Generating candidate replies...</p>
			) : replies.length === 0 ? (
				<p className="muted">
					No candidate replies yet. Generate replies to inspect results.
				</p>
			) : (
				<div className="candidate-reply-list">
					{replies.map((reply, index) => (
						<article
							key={reply.id}
							className={`candidate-reply-card ${selectedReplyId === reply.id ? "is-selected" : ""}`}
						>
							<div className="candidate-reply-header">
								<strong>Reply {index + 1}</strong>
								<span className={getRiskBadgeClass(reply.riskLevel)}>
									Risk: {reply.riskLevel}
								</span>
							</div>
							<p>{reply.content}</p>
							<div className="confidence-meter">
								<div
									className="confidence-meter-fill"
									style={{ width: `${Math.round(reply.confidence * 100)}%` }}
								/>
							</div>
							<p className="muted">
								Confidence: {Math.round(reply.confidence * 100)}%{" · "}
								Generated: {reply.generatedAt.toLocaleString()}
							</p>
							<button
								type="button"
								className="secondary-button"
								onClick={() => onSelectReply?.(reply)}
							>
								View Details
							</button>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
