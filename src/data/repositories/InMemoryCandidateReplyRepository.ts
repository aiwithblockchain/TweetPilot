import type {
  CandidateReply,
  CandidateReplyId,
  RiskLevel,
} from '../../domain/candidateReply';
import type { ICandidateReplyRepository } from './ICandidateReplyRepository';

function sortByNewest(replies: CandidateReply[]): CandidateReply[] {
  return replies.sort(
    (left, right) => right.generatedAt.getTime() - left.generatedAt.getTime()
  );
}

export class InMemoryCandidateReplyRepository
  implements ICandidateReplyRepository
{
  private replies: Map<CandidateReplyId, CandidateReply> = new Map();

  async save(reply: CandidateReply): Promise<void> {
    this.replies.set(reply.id, reply);
  }

  async findById(id: CandidateReplyId): Promise<CandidateReply | null> {
    return this.replies.get(id) ?? null;
  }

  async delete(id: CandidateReplyId): Promise<void> {
    this.replies.delete(id);
  }

  async findByCommentInput(commentInputId: string): Promise<CandidateReply[]> {
    return sortByNewest(
      Array.from(this.replies.values()).filter(
        (reply) => reply.commentInputId === commentInputId
      )
    );
  }

  async findByAccount(accountId: string): Promise<CandidateReply[]> {
    return sortByNewest(
      Array.from(this.replies.values()).filter(
        (reply) => reply.accountId === accountId
      )
    );
  }

  async findByRole(roleId: string): Promise<CandidateReply[]> {
    return sortByNewest(
      Array.from(this.replies.values()).filter((reply) => reply.roleId === roleId)
    );
  }

  async findByWorkspace(workspaceId: string): Promise<CandidateReply[]> {
    return sortByNewest(
      Array.from(this.replies.values()).filter(
        (reply) => reply.workspaceId === workspaceId
      )
    );
  }

  async countByCommentInput(commentInputId: string): Promise<number> {
    return Array.from(this.replies.values()).filter(
      (reply) => reply.commentInputId === commentInputId
    ).length;
  }

  async countByRiskLevel(riskLevel: RiskLevel): Promise<number> {
    return Array.from(this.replies.values()).filter(
      (reply) => reply.riskLevel === riskLevel
    ).length;
  }

  clear(): void {
    this.replies.clear();
  }
}
