import type { CandidateReply } from "../../domain/candidateReply";
import type { CommentInput } from "../../domain/commentInput";

type ReplyGenerationMetadataProps = {
	reply: CandidateReply | null;
	commentInput: CommentInput | null;
	roleName?: string | null;
	accountLabel?: string;
};

export default function ReplyGenerationMetadata({
	reply,
	commentInput,
	roleName,
	accountLabel,
}: ReplyGenerationMetadataProps) {
	return (
		<section className="panel reply-panel">
			<p className="panel-title">Generation Metadata</p>
			{!reply || !commentInput ? (
				<p className="muted">
					Select a generated reply to inspect metadata and relationships.
				</p>
			) : (
				<div className="metadata-grid">
					<div className="metadata-item">
						<span className="muted">Model Source</span>
						<strong>{reply.modelSource}</strong>
					</div>
					<div className="metadata-item">
						<span className="muted">Knowledge Hits</span>
						<strong>{reply.knowledgeHits}</strong>
					</div>
					<div className="metadata-item">
						<span className="muted">Role</span>
						<strong>{roleName ?? "Default role"}</strong>
					</div>
					<div className="metadata-item">
						<span className="muted">Account</span>
						<strong>{accountLabel ?? commentInput.accountId}</strong>
					</div>
					<div className="metadata-item">
						<span className="muted">Comment Input</span>
						<strong>{commentInput.id}</strong>
					</div>
					<div className="metadata-item">
						<span className="muted">Generated At</span>
						<strong>{reply.generatedAt.toLocaleString()}</strong>
					</div>
					{commentInput.targetTweetUrl && (
						<div className="metadata-item metadata-item-wide">
							<span className="muted">Linked Tweet</span>
							<a
								href={commentInput.targetTweetUrl}
								target="_blank"
								rel="noreferrer"
							>
								{commentInput.targetTweetUrl}
							</a>
						</div>
					)}
				</div>
			)}
		</section>
	);
}
