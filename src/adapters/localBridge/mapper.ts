// Adapter layer: maps LocalBridge raw responses to platform CommentInput objects
// This layer decouples platform models from external API structures

import type { CreateCommentInputParams } from "../../domain/commentInput";
import type {
	LocalBridgeRepliesResponse,
	LocalBridgeTweetResult,
} from "./types";

export interface AdaptedReply {
	tweetId: string;
	authorId: string;
	authorScreenName: string;
	content: string;
	createdAt: Date;
	targetTweetId: string;
}

// Extract tweet result from LocalBridge response structure
function extractTweetFromResult(
	result: LocalBridgeTweetResult | undefined,
): AdaptedReply | null {
	if (!result || !result.rest_id || !result.legacy?.full_text) {
		return null;
	}

	const authorId = result.core?.user_results?.result?.rest_id;
	const authorScreenName =
		result.core?.user_results?.result?.legacy?.screen_name;

	if (!authorId || !authorScreenName) {
		return null;
	}

	return {
		tweetId: result.rest_id,
		authorId,
		authorScreenName,
		content: result.legacy.full_text,
		createdAt: parseTwitterDate(result.legacy.created_at),
		targetTweetId: "", // Will be set by caller
	};
}

// Parse Twitter date format: "Mon Jan 01 00:00:00 +0000 2024"
function parseTwitterDate(dateStr: string): Date {
	return new Date(dateStr);
}

// Extract all replies from LocalBridge replies response
export function extractRepliesFromResponse(
	response: LocalBridgeRepliesResponse,
	targetTweetId: string,
): AdaptedReply[] {
	const replies: AdaptedReply[] = [];
	const instructions =
		response.data?.threaded_conversation_with_injections_v2?.instructions;

	if (!instructions) {
		return replies;
	}

	for (const instruction of instructions) {
		// Extract from entries
		if (instruction.entries) {
			for (const entry of instruction.entries) {
				// Skip the main tweet entry
				if (entry.entryId === `tweet-${targetTweetId}`) {
					continue;
				}

				const tweetResult = entry.content?.itemContent?.tweet_results?.result;
				const reply = extractTweetFromResult(tweetResult);

				if (reply) {
					reply.targetTweetId = targetTweetId;
					replies.push(reply);
				}
			}
		}

		// Extract from moduleItems (nested replies)
		if (instruction.moduleItems) {
			for (const moduleItem of instruction.moduleItems) {
				const tweetResult = moduleItem.item?.itemContent?.tweet_results?.result;
				const reply = extractTweetFromResult(tweetResult);

				if (reply) {
					reply.targetTweetId = targetTweetId;
					replies.push(reply);
				}
			}
		}
	}

	return replies;
}

// Map adapted reply to platform CommentInput creation params
export function mapReplyToCommentInputParams(
	reply: AdaptedReply,
	workspaceId: string,
	accountId: string,
): CreateCommentInputParams {
	return {
		workspaceId,
		accountId,
		content: reply.content,
		targetTweetId: reply.targetTweetId,
		targetTweetUrl: `https://x.com/${reply.authorScreenName}/status/${reply.tweetId}`,
		metadata: {
			authorId: reply.authorId,
			authorScreenName: reply.authorScreenName,
			tweetId: reply.tweetId,
			createdAt: reply.createdAt.toISOString(),
		},
	};
}
