import type { ReplyTask } from "../../domain/replyTask";
import type { useTaskGovernance } from "./useTaskGovernance";

type TaskGovernanceActionsProps = {
	task: ReplyTask;
	governance: ReturnType<typeof useTaskGovernance>;
};

export default function TaskGovernanceActions({
	task,
	governance,
}: TaskGovernanceActionsProps) {
	return (
		<section className="panel compact">
			<p className="panel-title">Governance Actions</p>
			<div className="governance-form">
				<label className="field field-inline">
					<span>Actor ID</span>
					<input
						value={governance.actorId}
						onChange={(event) => governance.setActorId(event.target.value)}
					/>
				</label>
				<label className="field field-inline">
					<span>Actor Role</span>
					<select
						value={governance.actorRole}
						onChange={(event) =>
							governance.setActorRole(
								event.target.value as "none" | "reviewer" | "admin",
							)
						}
					>
						<option value="admin">Admin</option>
						<option value="reviewer">Reviewer</option>
						<option value="none">None</option>
					</select>
				</label>
				<label className="field field-inline">
					<span>Assignee ID</span>
					<input
						value={governance.assigneeId}
						onChange={(event) => governance.setAssigneeId(event.target.value)}
					/>
				</label>
				<label className="field">
					<span>Note</span>
					<textarea
						value={governance.note}
						rows={3}
						onChange={(event) => governance.setNote(event.target.value)}
					/>
				</label>
			</div>

			<div className="action-row">
				<button
					type="button"
					className="action-button"
					onClick={() => void governance.assign()}
					disabled={governance.isSubmitting}
				>
					Assign
				</button>
				{task.status === "pending_review" ? (
					<>
						<button
							type="button"
							className="action-button"
							onClick={() => void governance.approve()}
							disabled={governance.isSubmitting}
						>
							Approve
						</button>
						<button
							type="button"
							className="secondary-button danger-button"
							onClick={() => void governance.reject()}
							disabled={governance.isSubmitting}
						>
							Reject
						</button>
						<button
							type="button"
							className="secondary-button"
							onClick={() => void governance.returnToQueue()}
							disabled={governance.isSubmitting}
						>
							Return To Queue
						</button>
					</>
				) : null}
				{task.status === "assigned" || task.status === "ready_for_execution" ? (
					<button
						type="button"
						className="action-button"
						onClick={() => void governance.takeOver()}
						disabled={governance.isSubmitting}
					>
						Take Over
					</button>
				) : null}
				{task.status === "in_takeover" ? (
					<>
						<button
							type="button"
							className="action-button"
							onClick={() => void governance.completeTakeover("ready_for_execution")}
							disabled={governance.isSubmitting}
						>
							Complete As Ready
						</button>
						<button
							type="button"
							className="secondary-button danger-button"
							onClick={() => void governance.completeTakeover("rejected")}
							disabled={governance.isSubmitting}
						>
							Complete As Rejected
						</button>
						<button
							type="button"
							className="secondary-button"
							onClick={() => void governance.completeTakeover("completed")}
							disabled={governance.isSubmitting}
						>
							Complete As Done
						</button>
					</>
				) : null}
			</div>

			{governance.error ? <p className="error-message">{governance.error}</p> : null}
		</section>
	);
}
