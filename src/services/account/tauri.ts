import { tauriInvoke } from '@/lib/tauri-api'
import type { LocalBridgeInstance } from './types'

export async function getInstances(): Promise<LocalBridgeInstance[]> {
  return tauriInvoke<LocalBridgeInstance[]>('get_instances')
}
