type ReviewQueueErrorStateProps = {
	message: string;
	onRetry: () => void;
};

export default function ReviewQueueErrorState({
	message,
	onRetry,
}: ReviewQueueErrorStateProps) {
	return (
		<section className="panel review-error-state" role="alert">
			<p className="panel-title">Review Queue Error</p>
			<p className="error-message">{message}</p>
			<div className="action-row">
				<button type="button" className="secondary-button" onClick={onRetry}>
					Retry
				</button>
			</div>
		</section>
	);
}
