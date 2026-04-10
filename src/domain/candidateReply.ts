import type { RoleId } from "./role";
import type { AccountId, WorkspaceId } from "./types";

export type CandidateReplyId = string;
export type RiskLevel = "low" | "medium" | "high";

export interface CandidateReply {
	id: CandidateReplyId;
	commentInputId: string;
	accountId: AccountId;
	roleId?: RoleId;
	workspaceId: WorkspaceId;
	content: string;
	riskLevel: RiskLevel;
	confidence: number;
	modelSource: string;
	knowledgeHits: number;
	generatedAt: Date;
	metadata?: Record<string, unknown>;
}

export interface CreateCandidateReplyParams {
	commentInputId: string;
	accountId: AccountId;
	roleId?: RoleId;
	workspaceId: WorkspaceId;
	content: string;
	riskLevel: RiskLevel;
	confidence: number;
	modelSource: string;
	knowledgeHits: number;
	metadata?: Record<string, unknown>;
}

export function generateCandidateReplyId(): CandidateReplyId {
	return crypto.randomUUID();
}

export function createCandidateReply(
	params: CreateCandidateReplyParams,
): CandidateReply {
	// 验证 confidence 范围
	if (params.confidence < 0 || params.confidence > 1) {
		throw new Error(
			`Confidence must be between 0 and 1, got ${params.confidence}`,
		);
	}

	return {
		id: generateCandidateReplyId(),
		commentInputId: params.commentInputId,
		accountId: params.accountId,
		roleId: params.roleId,
		workspaceId: params.workspaceId,
		content: params.content,
		riskLevel: params.riskLevel,
		confidence: params.confidence,
		modelSource: params.modelSource,
		knowledgeHits: params.knowledgeHits,
		generatedAt: new Date(),
		metadata: params.metadata,
	};
}
