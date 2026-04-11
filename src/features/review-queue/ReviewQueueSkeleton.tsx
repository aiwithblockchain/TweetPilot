export default function ReviewQueueSkeleton() {
	return (
		<div className="review-queue-grid" data-testid="review-queue-skeleton">
			<section className="panel review-list-panel">
				<div className="skeleton-line skeleton-line-short" />
				<div className="skeleton-card-list">
					<div className="skeleton-card" />
					<div className="skeleton-card" />
					<div className="skeleton-card" />
				</div>
			</section>
			<section className="panel review-detail-panel">
				<div className="skeleton-line skeleton-line-medium" />
				<div className="skeleton-block" />
				<div className="skeleton-block" />
				<div className="skeleton-block" />
			</section>
		</div>
	);
}
