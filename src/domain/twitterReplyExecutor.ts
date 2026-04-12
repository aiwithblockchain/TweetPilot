export interface PostReplyInput {
	tweetId: string;
	text: string;
	accountId: string;
	workspaceId: string;
	roleId?: string;
}

export interface PostReplySuccess {
	success: true;
	replyTweetId: string;
	rawResponse?: Record<string, unknown>;
}

export interface PostReplyFailure {
	success: false;
	code: string;
	message: string;
	retryable: boolean;
	requiresManualIntervention?: boolean;
	rawResponse?: Record<string, unknown>;
}

export type PostReplyResult = PostReplySuccess | PostReplyFailure;

export interface ITwitterReplyExecutor {
	readonly type: "localbridge" | "twitter-mcp";
	isAvailable(): Promise<boolean>;
	postReply(input: PostReplyInput): Promise<PostReplyResult>;
}
