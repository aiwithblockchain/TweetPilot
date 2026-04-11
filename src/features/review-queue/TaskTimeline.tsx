import type { ReplyTaskEvent } from "../../domain/replyTask";

type TaskTimelineProps = {
	events: ReplyTaskEvent[];
};

export default function TaskTimeline({ events }: TaskTimelineProps) {
	return (
		<section className="panel compact">
			<p className="panel-title">Event Timeline</p>
			<div className="timeline-list">
				{events.length === 0 ? (
					<p className="muted">No governance events recorded yet.</p>
				) : (
					events.map((event) => (
						<div key={event.id} className="timeline-item">
							<div className="timeline-item-header">
								<strong>{event.type}</strong>
								<span className="muted">
									{event.createdAt.toLocaleString()}
								</span>
							</div>
							<p className="muted">Actor: {event.actorId}</p>
							{event.payload ? (
								<pre className="timeline-payload">
									{JSON.stringify(event.payload, null, 2)}
								</pre>
							) : null}
						</div>
					))
				)}
			</div>
		</section>
	);
}
