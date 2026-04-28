use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TwitterBasicAccount {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub created_at: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
    pub last_seen: DateTime<Utc>,
}

impl TwitterBasicAccount {
    pub fn from_xuser(
        user: crate::services::localbridge::XUser,
        instance_id: String,
        extension_name: String,
    ) -> Option<Self> {
        let twitter_id = user.id?;

        Some(Self {
            twitter_id,
            screen_name: user.screen_name.unwrap_or_default(),
            display_name: user.name.unwrap_or_default(),
            avatar_url: user.profile_image_url,
            description: user.description,
            is_verified: user.verified.unwrap_or(false),
            followers_count: user.followers_count,
            following_count: user.following_count,
            tweet_count: user.tweet_count,
            favourites_count: user.favourites_count,
            listed_count: user.listed_count,
            media_count: user.media_count,
            created_at: user.created_at,
            instance_id,
            extension_name,
            last_seen: Utc::now(),
        })
    }
}
