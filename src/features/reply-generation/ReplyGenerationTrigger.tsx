import type { CommentInput } from "../../domain/commentInput";
import type { Role } from "../../domain/role";

type ReplyGenerationTriggerProps = {
	selectedComment: CommentInput | null;
	roles: Role[];
	selectedRoleId: string;
	generationCount: number;
	isGenerating: boolean;
	error?: string | null;
	onRoleChange: (roleId: string) => void;
	onGenerationCountChange: (count: number) => void;
	onGenerate: () => void;
};

export default function ReplyGenerationTrigger({
	selectedComment,
	roles,
	selectedRoleId,
	generationCount,
	isGenerating,
	error,
	onRoleChange,
	onGenerationCountChange,
	onGenerate,
}: ReplyGenerationTriggerProps) {
	const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

	return (
		<section className="panel reply-panel">
			<p className="panel-title">Reply Generation Trigger</p>
			{selectedComment ? (
				<>
					<div className="reply-preview-card">
						<strong>Selected Comment</strong>
						<p>{selectedComment.content}</p>
						<p className="muted">
							Account: {selectedComment.accountId}
							{" · "}
							Workspace: {selectedComment.workspaceId}
						</p>
					</div>

					<div className="reply-trigger-controls">
						<label className="field field-inline">
							<span>Role</span>
							<select
								value={selectedRoleId}
								onChange={(event) => onRoleChange(event.target.value)}
								disabled={isGenerating}
							>
								<option value="">Use Default Role</option>
								{roles.map((role) => (
									<option key={role.id} value={role.id}>
										{role.name}
									</option>
								))}
							</select>
						</label>

						<label className="field field-inline">
							<span>Count</span>
							<select
								value={generationCount}
								onChange={(event) =>
									onGenerationCountChange(Number(event.target.value))
								}
								disabled={isGenerating}
							>
								{[1, 2, 3, 4].map((count) => (
									<option key={count} value={count}>
										{count}
									</option>
								))}
							</select>
						</label>

						<button
							type="button"
							className="action-button"
							disabled={isGenerating}
							onClick={onGenerate}
						>
							{isGenerating ? "Generating..." : "Generate Replies"}
						</button>
					</div>

					<p className="muted">
						Active Role: {selectedRole?.name ?? "Default account role"}
					</p>
					{isGenerating && (
						<p className="feedback-message">Reply generation in progress...</p>
					)}
					{error && <p className="error-message">{error}</p>}
				</>
			) : (
				<p className="muted">Select a comment input first.</p>
			)}
		</section>
	);
}
