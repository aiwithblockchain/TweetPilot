import type {
	CandidateReply,
	CandidateReplyId,
	RiskLevel,
} from "../../domain/candidateReply";

export interface ICandidateReplyRepository {
	save(reply: CandidateReply): Promise<void>;
	findById(id: CandidateReplyId): Promise<CandidateReply | null>;
	delete(id: CandidateReplyId): Promise<void>;
	findByCommentInput(commentInputId: string): Promise<CandidateReply[]>;
	findByAccount(accountId: string): Promise<CandidateReply[]>;
	findByRole(roleId: string): Promise<CandidateReply[]>;
	findByWorkspace(workspaceId: string): Promise<CandidateReply[]>;
	countByCommentInput(commentInputId: string): Promise<number>;
	countByRiskLevel(riskLevel: RiskLevel): Promise<number>;
}
