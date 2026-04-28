export interface AppInstance {
  id: string
  name: string
  status: 'online' | 'offline' | 'connecting'
  lastActive: string
  screenName?: string
  extensionName?: string
}

export interface LayoutSidebarItem {
  id: string
  label: string
  description: string
}
