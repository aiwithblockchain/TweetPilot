// Basic types for LocalBridge integration
export interface LocalBridgeInstance {
  instanceId: string
  instanceName: string
}

export interface TwitterBasicInfo {
  id?: string
  screenName?: string
  name?: string
  profileImageUrl?: string
  description?: string
}
