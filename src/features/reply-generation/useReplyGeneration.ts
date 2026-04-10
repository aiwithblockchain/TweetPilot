import { useState } from "react";
import type { ReplyResult } from "../../agents/ReplyAgent";
import type { ICandidateReplyRepository } from "../../data/repositories/ICandidateReplyRepository";
import type { CandidateReply } from "../../domain/candidateReply";
import { createCandidateReply } from "../../domain/candidateReply";
import type { CommentInput } from "../../domain/commentInput";
import { candidateReplyRepository, replyAgent } from "../../services";

export interface ReplyGenerationTrace {
	commentInput: CommentInput;
	roleId?: string;
	roleName?: string | null;
}

export interface ReplyGenerationDependencies {
	replyAgent?: {
		generateMultipleReplies: (
			commentInput: CommentInput,
			count?: number,
			options?: { role?: string },
		) => Promise<ReplyResult[]>;
	};
	candidateReplyRepository?: Pick<ICandidateReplyRepository, "save">;
}

export function useReplyGeneration(
	dependencies: ReplyGenerationDependencies = {},
) {
	const generationAgent = dependencies.replyAgent ?? replyAgent;
	const replyRepository =
		dependencies.candidateReplyRepository ?? candidateReplyRepository;
	const [isGenerating, setIsGenerating] = useState(false);
	const [replies, setReplies] = useState<CandidateReply[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [trace, setTrace] = useState<ReplyGenerationTrace | null>(null);

	const generateReplies = async (
		commentInput: CommentInput,
		roleId?: string,
		count: number = 3,
		roleName?: string | null,
	) => {
		setIsGenerating(true);
		setError(null);

		try {
			const results = await generationAgent.generateMultipleReplies(
				commentInput,
				count,
				roleId ? { role: roleId } : undefined,
			);

			const savedReplies = await Promise.all(
				results.map(async (result) => {
					const modelSource =
						typeof result.metadata?.modelSource === "string"
							? result.metadata.modelSource
							: "unknown";
					const knowledgeHits =
						typeof result.metadata?.knowledgeHits === "number"
							? result.metadata.knowledgeHits
							: 0;

					const reply = createCandidateReply({
						commentInputId: commentInput.id,
						accountId: commentInput.accountId,
						roleId,
						workspaceId: commentInput.workspaceId,
						content: result.reply,
						riskLevel: result.riskLevel,
						confidence: result.confidence,
						modelSource,
						knowledgeHits,
					});

					await replyRepository.save(reply);
					return reply;
				}),
			);

			setReplies(savedReplies);
			setTrace({
				commentInput,
				roleId,
				roleName: roleName ?? null,
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to generate replies.",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	return {
		generateReplies,
		isGenerating,
		replies,
		error,
		trace,
	};
}
