import { tauriInvoke } from '@/lib/tauri-api'
import type { AppInstance } from '@/types/layout'

interface TauriInstance {
  instanceId?: string
  id?: string
  instanceName?: string
  extensionName?: string
  screen_name?: string
  screenName?: string
  lastActive?: string
  last_active?: string
  status?: string
}

function normalizeInstanceStatus(status?: string): AppInstance['status'] {
  const normalized = status?.toLowerCase()

  if (normalized === 'online' || normalized === 'active' || normalized === 'connected') {
    return 'online'
  }

  if (normalized === 'connecting' || normalized === 'pending') {
    return 'connecting'
  }

  return 'offline'
}

function toRelativeTime(value?: string): string {
  if (!value) return '未知'

  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    const date = new Date(numeric)
    if (!Number.isNaN(date.getTime())) {
      return formatRelative(date)
    }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return formatRelative(date)
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  if (diffMs <= 0) return '刚刚'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function mapInstance(instance: TauriInstance): AppInstance {
  return {
    id: instance.instanceId || instance.id || 'unknown',
    name: instance.instanceName || instance.extensionName || instance.screen_name || 'Unknown Instance',
    status: normalizeInstanceStatus(instance.status),
    lastActive: toRelativeTime(instance.lastActive || instance.last_active),
    screenName: instance.screen_name || instance.screenName,
    extensionName: instance.extensionName,
  }
}

export const layoutService = {
  async getInstances(): Promise<AppInstance[]> {
    const response = await tauriInvoke<TauriInstance[]>('get_instances')
    return response.map(mapInstance)
  },
}
