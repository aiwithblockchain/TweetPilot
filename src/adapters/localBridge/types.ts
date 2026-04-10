// LocalBridge API raw response types
// These types represent the raw structure returned by LocalBridge API

export interface LocalBridgeInstance {
	clientName: string;
	instanceId: string;
	instanceName: string;
	clientVersion: string;
	capabilities: string[];
	connectedAt: string;
	lastSeenAt: string;
	isTemporary: boolean;
}

export interface LocalBridgeTabStatus {
	tabs: Array<{
		tabId: number;
		url: string;
		active: boolean;
	}>;
	activeXUrl?: string;
	hasXTabs: boolean;
	isLoggedIn: boolean;
	activeXTabId?: number;
}

export interface LocalBridgeTweetResult {
	__typename: string;
	rest_id: string;
	core?: {
		user_results?: {
			result?: {
				rest_id: string;
				legacy?: {
					screen_name: string;
					name?: string;
				};
			};
		};
	};
	legacy?: {
		created_at: string;
		full_text: string;
		favorite_count?: number;
		retweet_count?: number;
		reply_count?: number;
	};
}

export interface LocalBridgeTweetDetailResponse {
	data?: {
		threaded_conversation_with_injections_v2?: {
			instructions?: Array<{
				type: string;
				entries?: Array<{
					entryId: string;
					content?: {
						entryType: string;
						itemContent?: {
							itemType: string;
							tweet_results?: {
								result?: LocalBridgeTweetResult;
							};
						};
					};
				}>;
			}>;
		};
	};
}

export interface LocalBridgeRepliesResponse {
	data?: {
		threaded_conversation_with_injections_v2?: {
			instructions?: Array<{
				type: string;
				entries?: Array<{
					entryId: string;
					content?: {
						entryType: string;
						itemContent?: {
							itemType: string;
							tweet_results?: {
								result?: LocalBridgeTweetResult;
							};
						};
					};
				}>;
				moduleItems?: Array<{
					entryId: string;
					item?: {
						itemContent?: {
							tweet_results?: {
								result?: LocalBridgeTweetResult;
							};
						};
					};
				}>;
			}>;
		};
	};
}
