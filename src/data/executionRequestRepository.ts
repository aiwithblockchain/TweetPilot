import type {
	ExecutionRequest,
	ExecutionRequestId,
} from "../domain/executionRequest";

export interface IExecutionRequestRepository {
	save(request: ExecutionRequest): Promise<void>;
	findById(id: ExecutionRequestId): Promise<ExecutionRequest | null>;
	findByTaskId(taskId: string): Promise<ExecutionRequest[]>;
	findByAccountId(
		accountId: string,
		limit?: number,
	): Promise<ExecutionRequest[]>;
	update(request: ExecutionRequest): Promise<void>;
}

function cloneExecutionRequest(request: ExecutionRequest): ExecutionRequest {
	return {
		...request,
		payload: { ...request.payload },
		result: request.result
			? {
					...request.result,
					executedAt: new Date(request.result.executedAt),
				}
			: undefined,
		error: request.error
			? {
					...request.error,
					details: request.error.details ? { ...request.error.details } : undefined,
				}
			: undefined,
		createdAt: new Date(request.createdAt),
		updatedAt: new Date(request.updatedAt),
		executedAt: request.executedAt ? new Date(request.executedAt) : undefined,
	};
}

export class InMemoryExecutionRequestRepository
	implements IExecutionRequestRepository
{
	private requests = new Map<ExecutionRequestId, ExecutionRequest>();

	async save(request: ExecutionRequest): Promise<void> {
		this.requests.set(request.id, cloneExecutionRequest(request));
	}

	async findById(id: ExecutionRequestId): Promise<ExecutionRequest | null> {
		const request = this.requests.get(id);
		return request ? cloneExecutionRequest(request) : null;
	}

	async findByTaskId(taskId: string): Promise<ExecutionRequest[]> {
		return Array.from(this.requests.values())
			.filter((request) => request.taskId === taskId)
			.map(cloneExecutionRequest);
	}

	async findByAccountId(
		accountId: string,
		limit?: number,
	): Promise<ExecutionRequest[]> {
		const results = Array.from(this.requests.values())
			.filter((request) => request.payload.accountId === accountId)
			.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
			.map(cloneExecutionRequest);

		return typeof limit === "number" ? results.slice(0, limit) : results;
	}

	async update(request: ExecutionRequest): Promise<void> {
		if (!this.requests.has(request.id)) {
			throw new Error(`ExecutionRequest ${request.id} not found`);
		}

		this.requests.set(request.id, cloneExecutionRequest(request));
	}

	clear(): void {
		this.requests.clear();
	}
}
